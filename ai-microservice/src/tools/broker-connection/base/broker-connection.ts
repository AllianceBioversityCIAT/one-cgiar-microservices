import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { env } from 'process';
import { firstValueFrom } from 'rxjs';

export abstract class BrokerConnectionBase {
  private readonly log: Logger = new Logger('Broker connection');
  protected client: ClientProxy;

  constructor(
    queueName: string,
    private readonly configService: ConfigService,
  ) {
    const queueHost: string = this.configService.get<string>('RABBITMQ_URL');
    this.client = ClientProxyFactory.create({
      transport: Transport.RMQ,
      options: {
        urls: [queueHost],
        queue: queueName,
        queueOptions: {
          durable: true,
        },
      },
    });
  }

  async emitToPattern<T, Y = T>(
    pattern: string,
    message: T,
    logger: boolean = false,
  ): Promise<Y> {
    const parsedMessage: string = JSON.stringify(message);
    return firstValueFrom(this.client.emit(pattern, parsedMessage)).then(
      (response: Y) => {
        if (logger) {
          this.log.log(`Message emitted to pattern: ${pattern}`);
          this.log.log(`Message: ${JSON.stringify(response)}`);
        }
        return response;
      },
    );
  }

  async sendToPattern<T, Y = T>(
    pattern: string,
    message: T,
    logger: boolean = false,
  ): Promise<Y> {
    return firstValueFrom(this.client.send(pattern, message)).then(
      (response: Y) => {
        if (logger) {
          this.log.log(`Message sent to pattern: ${pattern}`);
          this.log.log(`Message: ${JSON.stringify(response)}`);
        }
        return response;
      },
    );
  }
}
