import 'dotenv/config';
import { Injectable } from '@nestjs/common';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { env } from 'process';

@Injectable()
export class RabbitMQService {
  private client: ClientProxy;

  constructor() {
    const queueHost: string = `amqps://${env.MS_RMQ_USER}:${env.MS_RMQ_PASSWORD}@${env.MS_RMQ_HOST}`;
    this.client = ClientProxyFactory.create({
      transport: Transport.RMQ,
      options: {
        urls: [queueHost],
        queue: env.MS_QUEUE_PATH,
        queueOptions: {
          durable: true,
        },
      },
    });
  }

  async emitToPattern<T>(pattern: string, message: T) {
    return this.client.emit(pattern, message);
  }
}
