import { Injectable, HttpStatus } from '@nestjs/common';
import { ServiceResponseDto } from './domain/shared/global-dto/service-response.dto';
import { ResponseUtils } from './domain/utils/response.utils';
import { NotificationsService } from './domain/notifications/notifications.service';

@Injectable()
export class AppService {
  constructor(private readonly _notificationsService: NotificationsService) {}

  getHello(): ServiceResponseDto<string> {
    const data = 'Welcome to the Reports Microservice!';

    return ResponseUtils.format({
      data,
      description:
        'The Reports Microservice is running for CGIAR applications.',
      status: HttpStatus.OK,
    });
  }

  slackNotification(): ServiceResponseDto<string> {
    const emoji = ':report:';
    const text = 'Reports Microservice!';
    const color = '#00FF00';
    const title = 'Slack Notification Test';
    const info = 'The Slack notification is working.';
    const priority = 'High';

    this._notificationsService.sendSlackNotification(
      emoji,
      text,
      color,
      title,
      info,
      priority,
    );

    return ResponseUtils.format({
      data: 'Slack notification sent successfully!',
      description: 'The Slack notification was sent successfully.',
      status: HttpStatus.OK,
    });
  }
}
