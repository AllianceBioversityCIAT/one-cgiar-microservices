import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ServerResponseDto } from '../global-dto/server-response.dto';
import { SlackService } from '../../tools/slack/slack.service';
import { SlackChannelsEnum } from '../../tools/slack/enum/channels.enum';
import { StatusColorEnum } from '../../tools/slack/enum/status-color.enum';

@Catch()
export class GlobalExceptions implements ExceptionFilter {
  private readonly _logger: Logger = new Logger('System');
  constructor(private readonly _slackService: SlackService) {}
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status = exception?.status || HttpStatus.INTERNAL_SERVER_ERROR;
    const description = exception?.name;
    const error = exception?.message;

    const res: ServerResponseDto<unknown> = {
      description: description,
      status: status,
      errors: error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    this._logger.error((exception as InternalServerErrorException)?.stack);
    this._slackService.sendSlackNotification(
      SlackChannelsEnum.MICROSERVICES_NOTIFICATIONS,
      {
        color: StatusColorEnum.ERROR,
        emoji: ':email:',
        text: 'Email service',
        title: 'Error notification details',
        info: `An error occurred while sending. "${error}"`,
        priority: 'High',
      },
    );
    response.status(status).json(res);
  }
}
