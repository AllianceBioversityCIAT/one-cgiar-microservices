import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailNotificationManagementService implements OnModuleInit {
  private readonly _logger = new Logger(
    EmailNotificationManagementService.name,
  );
  private authHeaderMs: { username: string; password: string };

  constructor(
    @Inject('EMAIL_SERVICE') private readonly _client: ClientProxy,
    private readonly _configService: ConfigService,
  ) {
    this.authHeaderMs = {
      username: this._configService.get<string>('MS_NOTIFICATION_USER'),
      password: this._configService.get<string>('MS_NOTIFICATION_PASSWORD'),
    };
  }

  async onModuleInit() {
    try {
      await this._client.connect();
      this._logger.log('Successfully connected to RabbitMQ Email MicroService');
    } catch (error) {
      this._logger.error(
        'Failed to connect to RabbitMQ Email MicroService',
        error.message,
      );
    }
  }

  sendEmail(configMessageDto: any) {
    const payload = {
      auth: this.authHeaderMs,
      data: configMessageDto,
    };
    this._client.emit('send', payload);
  }
}
