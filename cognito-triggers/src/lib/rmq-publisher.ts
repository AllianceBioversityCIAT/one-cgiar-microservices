import * as amqp from 'amqplib';

/**
 * Raw-`amqplib` publisher that speaks the wire format of the NestJS RabbitMQ
 * transport, so `notification-microservice`'s `@MessagePattern('send')` handler
 * picks the message up exactly as it does from `auth-microservice`'s
 * `ClientProxy.emit('send', payload)`.
 *
 * `@nestjs/microservices/client/client-rmq.js#dispatchEvent` serialises an
 * **event** as `Buffer.from(JSON.stringify({ pattern, data }))` and calls
 * `channel.sendToQueue(queue, content, options)`. Unlike `send()`, an event
 * carries **no `id`/`correlationId`**, which is how `ServerRMQ` tells the two
 * apart. This module reproduces that envelope byte for byte.
 */

/** Connection timeout — Cognito gives a trigger 5 s before it fails the flow. */
const CONNECT_TIMEOUT_MS = 3_000;

/** Credentials the notification microservice's `AuthInterceptor` validates. */
export interface NotificationAuth {
  username: string;
  password: string;
}

/**
 * Resolves the broker URL. **No path segment is ever appended** — the queue is
 * addressed by name at publish time (`MS_NOTIFICATION_QUEUE`), never through
 * the connection URL.
 *
 * Precedence:
 * 1. `MS_NOTIFICATION_HOST` — a complete URL, the shape `auth-microservice`
 *    passes to `ClientsModule.register` today.
 * 2. `amqps://<MS_RMQ_USER>:<MS_RMQ_PASSWORD>@<MS_RMQ_HOST>` — byte for byte
 *    the shape `notification-microservice/server/src/main.ts:44` builds.
 */
export function buildBrokerUrl(): string {
  const override = process.env.MS_NOTIFICATION_HOST;
  if (override) return override;

  const host = process.env.MS_RMQ_HOST;
  if (!host) {
    throw new Error(
      'Broker not configured: set MS_NOTIFICATION_HOST, or MS_RMQ_HOST with MS_RMQ_USER / MS_RMQ_PASSWORD',
    );
  }

  const schemeMatch = /^([a-z][a-z0-9+.-]*):\/\//i.exec(host);
  const scheme = schemeMatch ? schemeMatch[1] : 'amqps';
  const authority = schemeMatch ? host.slice(schemeMatch[0].length) : host;

  const user = encodeURIComponent(process.env.MS_RMQ_USER ?? '');
  const password = encodeURIComponent(process.env.MS_RMQ_PASSWORD ?? '');

  return `${scheme}://${user}:${password}@${authority}`;
}

/**
 * The `auth` half of the notification envelope — validated by
 * `notification-microservice`'s `AuthInterceptor` against CLARISA.
 */
export function notificationAuth(): NotificationAuth {
  return {
    username: process.env.MS_NOTIFICATION_USER ?? '',
    password: process.env.MS_NOTIFICATION_PASSWORD ?? '',
  };
}

/**
 * Publishes one NestJS-shaped event to `queue` and waits for the broker
 * confirm before returning — a Lambda is frozen the instant its handler
 * resolves, so an unconfirmed publish can be lost.
 *
 * The queue is not asserted: it is owned and declared by
 * `notification-microservice`, and re-asserting it with different arguments
 * would kill the channel with `PRECONDITION_FAILED`.
 *
 * Throws on any broker failure; the caller turns that into `email_failed`
 * (`OTP-R-35`) without failing the challenge.
 */
export async function publishEvent(
  queue: string,
  pattern: string,
  payload: unknown,
): Promise<void> {
  const connection = await amqp.connect(buildBrokerUrl(), {
    timeout: CONNECT_TIMEOUT_MS,
  });

  try {
    const channel = await connection.createConfirmChannel();
    try {
      channel.sendToQueue(
        queue,
        Buffer.from(JSON.stringify({ pattern, data: payload })),
        { persistent: true },
      );
      await channel.waitForConfirms();
    } finally {
      await channel.close();
    }
  } finally {
    await connection.close();
  }
}
