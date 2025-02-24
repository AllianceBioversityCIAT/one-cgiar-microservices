import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ResponseUtils } from '../utils/response.utils';

@Injectable()
export class NotificationsService {
  private readonly slackWebhookUrl: string;
  private readonly _logger = new Logger(NotificationsService.name);
  private readonly isProduction: boolean;

  constructor(private readonly configService: ConfigService) {
    this.slackWebhookUrl = this.configService.get<string>('SLACK_WEBHOOK_URL');
    this.isProduction =
      this.configService.get<string>('IS_PRODUCTION') === 'true';
  }

  async sendSlackNotification(
    emoji: string,
    text: string,
    color: string,
    title: string,
    info: string,
    priority: string,
  ) {
    try {
      const response = await axios.post(this.slackWebhookUrl, {
        channel: '#microservices-notifications',
        icon_emoji: emoji,
        text: text,
        username: 'ROAR Mining Microservice',
        attachments: [
          {
            color: color,
            title: title,
            text: info,
            fields: [
              {
                title: 'Priority',
                value: priority,
                short: false,
              },
              {
                title: 'Environment',
                value: this.isProduction ? 'Production' : '🚧 Development',
                short: true,
              },
              {
                title: 'Timestamp',
                value: new Date().toISOString(),
                short: true,
              },
            ],
            footer: 'ROAR Mining Microservice',
            ts: Math.floor(Date.now() / 1000),
          },
        ],
      });

      return ResponseUtils.format({
        description: 'Notification sent successfully',
        status: HttpStatus.OK,
        data: response?.data,
      });
    } catch (error) {
      this._logger.error(`Error sending slack notification: ${error}`);
    }
  }
}
