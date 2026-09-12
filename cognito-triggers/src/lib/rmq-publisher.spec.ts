jest.mock('amqplib', () => ({ connect: jest.fn() }));

import * as amqp from 'amqplib';

import {
  buildBrokerUrl,
  notificationAuth,
  publishEvent,
} from './rmq-publisher';

const connect = amqp.connect as unknown as jest.Mock;

interface ChannelStub {
  sendToQueue: jest.Mock;
  waitForConfirms: jest.Mock;
  close: jest.Mock;
}

interface ConnectionStub {
  createConfirmChannel: jest.Mock;
  close: jest.Mock;
}

function stubBroker(): { channel: ChannelStub; connection: ConnectionStub } {
  const channel: ChannelStub = {
    sendToQueue: jest.fn().mockReturnValue(true),
    waitForConfirms: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  };
  const connection: ConnectionStub = {
    createConfirmChannel: jest.fn().mockResolvedValue(channel),
    close: jest.fn().mockResolvedValue(undefined),
  };
  connect.mockResolvedValue(connection);
  return { channel, connection };
}

describe('rmq-publisher', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env.MS_RMQ_HOST = 'broker.example.org';
    process.env.MS_RMQ_USER = 'rmq-user';
    process.env.MS_RMQ_PASSWORD = 'rmq-pass';
    process.env.MS_NOTIFICATION_QUEUE = 'email-queue';
    process.env.MS_NOTIFICATION_USER = 'ms-user';
    process.env.MS_NOTIFICATION_PASSWORD = 'ms-pass';
    delete process.env.MS_NOTIFICATION_HOST;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  describe('buildBrokerUrl', () => {
    it('builds amqps://<user>:<pass>@<host> exactly as notification-microservice main.ts:44 does', () => {
      expect(buildBrokerUrl()).toBe(
        'amqps://rmq-user:rmq-pass@broker.example.org',
      );
    });

    it('never appends a path segment — the queue is addressed by name, not by URL', () => {
      const url = new URL(buildBrokerUrl());

      expect(url.pathname).toBe('');
      expect(buildBrokerUrl()).not.toContain('broker.example.org/');
    });

    it('keeps the scheme when MS_RMQ_HOST already carries one', () => {
      process.env.MS_RMQ_HOST = 'amqp://broker.example.org:5672';

      expect(buildBrokerUrl()).toBe(
        'amqp://rmq-user:rmq-pass@broker.example.org:5672',
      );
    });

    it('percent-encodes credentials so a / or @ in the password cannot break the URL', () => {
      process.env.MS_RMQ_PASSWORD = 'p@ss/word';

      expect(buildBrokerUrl()).toBe(
        'amqps://rmq-user:p%40ss%2Fword@broker.example.org',
      );
    });

    it('uses MS_NOTIFICATION_HOST verbatim when set (the auth-microservice shape)', () => {
      process.env.MS_NOTIFICATION_HOST =
        'amqps://other:secret@another.example.org/other-vhost';

      expect(buildBrokerUrl()).toBe(
        'amqps://other:secret@another.example.org/other-vhost',
      );
    });

    it('throws when no broker is configured, so the caller reports email_failed', () => {
      delete process.env.MS_RMQ_HOST;

      expect(() => buildBrokerUrl()).toThrow(/MS_RMQ_HOST/);
    });
  });

  describe('notificationAuth', () => {
    it('reads the notification credentials from the environment', () => {
      expect(notificationAuth()).toEqual({
        username: 'ms-user',
        password: 'ms-pass',
      });
    });
  });

  describe('publishEvent', () => {
    it('connects to the configured broker with a bounded timeout', async () => {
      stubBroker();

      await publishEvent('email-queue', 'send', { hello: 'world' });

      expect(connect).toHaveBeenCalledWith(
        'amqps://rmq-user:rmq-pass@broker.example.org',
        expect.objectContaining({ timeout: expect.any(Number) }),
      );
    });

    it('writes the NestJS event envelope { pattern, data } as JSON to the queue', async () => {
      const { channel } = stubBroker();

      await publishEvent('email-queue', 'send', { hello: 'world' });

      expect(channel.sendToQueue).toHaveBeenCalledTimes(1);
      const [queue, content, options] = channel.sendToQueue.mock.calls[0] as [
        string,
        Buffer,
        Record<string, unknown>,
      ];
      expect(queue).toBe('email-queue');
      expect(Buffer.isBuffer(content)).toBe(true);
      expect(JSON.parse(content.toString('utf8'))).toEqual({
        pattern: 'send',
        data: { hello: 'world' },
      });
      expect(options).toEqual({ persistent: true });
    });

    it('carries no id field — an emit is an event, not a request/response', async () => {
      const { channel } = stubBroker();

      await publishEvent('email-queue', 'send', { hello: 'world' });

      const [, content] = channel.sendToQueue.mock.calls[0] as [string, Buffer];
      expect(Object.keys(JSON.parse(content.toString('utf8'))).sort()).toEqual([
        'data',
        'pattern',
      ]);
    });

    it('waits for the broker confirm before the Lambda freezes', async () => {
      const { channel } = stubBroker();

      await publishEvent('email-queue', 'send', { hello: 'world' });

      expect(channel.waitForConfirms).toHaveBeenCalledTimes(1);
      expect(channel.sendToQueue.mock.invocationCallOrder[0]).toBeLessThan(
        channel.waitForConfirms.mock.invocationCallOrder[0],
      );
    });

    it('closes the channel and the connection', async () => {
      const { channel, connection } = stubBroker();

      await publishEvent('email-queue', 'send', { hello: 'world' });

      expect(channel.close).toHaveBeenCalledTimes(1);
      expect(connection.close).toHaveBeenCalledTimes(1);
    });

    it('closes the connection even when the publish fails, and rethrows', async () => {
      const { channel, connection } = stubBroker();
      channel.waitForConfirms.mockRejectedValue(new Error('broker nacked'));

      await expect(
        publishEvent('email-queue', 'send', { hello: 'world' }),
      ).rejects.toThrow('broker nacked');

      expect(connection.close).toHaveBeenCalledTimes(1);
    });

    it('rejects when the broker is unreachable', async () => {
      connect.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        publishEvent('email-queue', 'send', { hello: 'world' }),
      ).rejects.toThrow('ECONNREFUSED');
    });

    it('never writes the broker URL or the credentials to the console', async () => {
      stubBroker();
      const logSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => undefined);
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      await publishEvent('email-queue', 'send', { hello: 'world' });

      expect(logSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });
});
