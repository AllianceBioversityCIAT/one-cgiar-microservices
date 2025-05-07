import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { env } from 'process';
import { ResponseUtils } from '../../shared/utils/response.utils';
import { SlackChannelsEnum } from './enum/channels.enum';

@Injectable()
export class SlackService {
  private slackWebhookUrl: string;
  private readonly _logger = new Logger(SlackService.name);

  constructor() {
    this.slackWebhookUrl = env.MS_SLACK_WEBHOOK_URL;
  }

  async sendSlackNotification(
    channel: SlackChannelsEnum,
    config: ConfigSlackMessageDto,
  ) {
    try {
      const { emoji, text, color, title, info, priority } = config;
      const response = await axios.post(this.slackWebhookUrl, {
        channel: channel,
        icon_emoji: emoji,
        text: text,
        username: 'Reports Microservice',
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
                value: env.MS_ENVIRONMENT,
                short: true,
              },
              {
                title: 'Timestamp',
                value: new Date().toISOString(),
                short: true,
              },
            ],
            footer: 'Reports Microservice',
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

export class ConfigSlackMessageDto {
  public emoji: string;
  public text: string;
  public color: string;
  public title: string;
  public info: string;
  public priority: string;
}
