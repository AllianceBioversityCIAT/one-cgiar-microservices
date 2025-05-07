import { Injectable, Logger, Module } from '@nestjs/common';
import { ResClarisaValidateConectioDto } from '../../tools/clarisa/dtos/clarisa-create-conection.dto';
import { ConfigMessageDto } from '../global-dto/mailer.dto';
import { SlackService } from '../../tools/slack/slack.service';
import { SlackChannelsEnum } from '../../tools/slack/enum/channels.enum';
import { StatusColorEnum } from '../../tools/slack/enum/status-color.enum';

@Injectable()
@Module({})
export class CustomLogger {
  private readonly _logger: Logger = new Logger('System');

  constructor(private readonly _slackService: SlackService) {}

  public emailStatus(
    from: ResClarisaValidateConectioDto,
    dataEmail: ConfigMessageDto,
    error?: any,
  ) {
    const baseMessage = `[${getDate()}] (${from.client_id}) ${from.sender_mis.acronym} - ${from.sender_mis.environment}:`;
    if (!error) {
      const message = `${baseMessage} Was sent correctly. "${dataEmail.emailBody.subject}"`;
      this._logger.verbose(message);
      this._slackService.sendSlackNotification(
        SlackChannelsEnum.MICROSERVICES_NOTIFICATIONS,
        {
          color: StatusColorEnum.SUCCESS,
          title: 'Email sent',
          emoji: ':email:',
          info: message,
          text: 'Email service',
          priority: 'High',
        },
      );
    } else {
      const message = `${baseMessage} An error occurred while sending. "${dataEmail.emailBody.subject}"`;
      this._logger.error(
        `${baseMessage} An error occurred while sending. "${dataEmail.emailBody.subject}"`,
      );
      this._logger.error(error);
      this._slackService.sendSlackNotification(
        SlackChannelsEnum.MICROSERVICES_NOTIFICATIONS,
        {
          color: StatusColorEnum.ERROR,
          title: 'Error notification details',
          emoji: ':email:',
          info: `${message}\n Error: ${error}`,
          text: 'Email service',
          priority: 'High',
        },
      );
    }
  }
}

export const emailStatus = (
  logger: Logger,
  from: ResClarisaValidateConectioDto,
  dataEmail: ConfigMessageDto,
  error?: any,
) => {
  const baseMessage = `[${getDate()}] (${from.client_id}) ${from.sender_mis.acronym} - ${from.sender_mis.environment}:`;
  if (!error) {
    logger.verbose(
      `${baseMessage} Was sent correctly. "${dataEmail.emailBody.subject}"`,
    );
  } else {
    logger.error(
      `${baseMessage} An error occurred while sending. "${dataEmail.emailBody.subject}"`,
    );
    logger.error(error);
  }
};

const getDate = (): string => {
  const currentDate = new Date();
  const formattedDate = `${currentDate.getFullYear()}/${(currentDate.getMonth() + 1).toString().padStart(2, '0')}/${currentDate.getDate().toString().padStart(2, '0')}`;
  const formattedTime = `${currentDate.getHours().toString().padStart(2, '0')}:${currentDate.getMinutes().toString().padStart(2, '0')}`;
  const dateTimeString = `${formattedDate} ${formattedTime}`;
  return dateTimeString;
};
