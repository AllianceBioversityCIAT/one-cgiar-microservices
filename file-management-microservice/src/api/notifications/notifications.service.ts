import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { env } from 'process';
import { ResponseUtils } from '../../utils/response.utils';

@Injectable()
export class NotificationsService {
  private slackWebhookUrl: string;
  private readonly _logger = new Logger(NotificationsService.name);

  constructor() {
    this.slackWebhookUrl = env.SLACK_WEBHOOK_URL;
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
      const isProduction = process.env.IS_PRODUCTION === 'true';
      const response = await axios.post(this.slackWebhookUrl, {
        channel: '#microservices-notifications',
        icon_emoji: emoji,
        text: text,
        username: 'File Management Microservice',
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
                value: isProduction
                  ? 'Production'
                  : 'Development :construction:',
                short: true,
              },
              {
                title: 'Timestamp',
                value: new Date().toISOString(),
                short: true,
              },
            ],
            footer: 'File Management Microservice',
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
