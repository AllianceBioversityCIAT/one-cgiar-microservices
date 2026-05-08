import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { Transporter } from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import { env } from 'process';
import { ConfigMessageDto } from '../../shared/global-dto/mailer.dto';
import { SubscribeApplicationDto } from './dto/ubscribe-application.dto';
import { ResponseUtils } from '../../shared/utils/response.utils';
import Mail from 'nodemailer/lib/mailer';
import { ClarisaService } from '../../tools/clarisa/clarisa.service';
import { ServiceResponseDto } from '../../shared/global-dto/service-response.dto';
import { CustomLogger } from '../../shared/utils/logger.utils';
import { mailerConnection } from '../../tools/mailer/mailer.connection';
import * as juice from 'juice';

@Injectable()
export class MailerService {
  private transporter: Transporter<SMTPTransport.SentMessageInfo>;
  constructor(
    private readonly _clarisaService: ClarisaService,
    private readonly customLogger: CustomLogger,
  ) {
    this.transporter = mailerConnection();
  }

  private _getEnv(environment: string): string {
    if (environment !== 'PROD' && environment !== undefined)
      return `${environment} - `;
    return '';
  }

  async sendMail(
    configMessage: ConfigMessageDto,
  ): Promise<ServiceResponseDto<SMTPTransport.SentMessageInfo>> {
    const subject = configMessage?.emailBody.subject || '<No subject>';
    const emailsTo: string[] = this.formatEmails(configMessage?.emailBody?.to);
    const emailsCc: string[] = this.formatEmails(configMessage?.emailBody?.cc);
    const emailsBcc: string[] = this.formatEmails(
      configMessage?.emailBody?.bcc,
    );
    const emailFrom: string =
      configMessage?.from?.email || `${env.MS_DEFAULT_EMAIL}`;
    const nameFrom: string = `${configMessage?.from?.name || 'One CGIAR Notification'} No reply`;
    const fromBofy: Mail.Address = {
      name: nameFrom,
      address: emailFrom,
    };
    const text: string = configMessage?.emailBody?.message?.text || '';

    const validEmail = this.validMultiplesEmails(emailsTo, emailsCc);
    if (!validEmail)
      throw new BadRequestException('No valid emails found in "TO" or "CC"');

    let htmlBody = '';
    if (configMessage?.emailBody?.message?.file) {
      htmlBody = juice(
        Buffer.from(configMessage?.emailBody?.message?.file)?.toString('utf8'),
        {
          inlinePseudoElements: false,
          preserveFontFaces: true,
          preserveImportant: true,
          applyAttributesTableElements: true,
        },
      );
    }

    return this.transporter
      .sendMail({
        to: emailsTo,
        cc: emailsCc,
        bcc: emailsBcc,
        from: fromBofy,
        subject: `${this._getEnv(configMessage.environment)}${subject}`,
        text: text,
        html: htmlBody,
      })
      .then((res) => {
        this.customLogger.emailStatus(configMessage.sender, configMessage);
        return ResponseUtils.format({
          description: 'Email sent successfully',
          data: res,
          status: HttpStatus.CREATED,
        });
      })
      .catch((error) => {
        this.customLogger.emailStatus(
          configMessage.sender,
          configMessage,
          error,
        );
        return ResponseUtils.format({
          description: 'Error sending email',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          errors: error,
        });
      });
  }

  private formatEmails(emails: string | string[]): string[] {
    if (!emails) return [];
    return Array.isArray(emails)
      ? emails
      : emails.split(',').map((email) => email?.trim());
  }

  async subscribeApplication(newApplication: SubscribeApplicationDto) {
    return this._clarisaService
      .createConnection({
        acronym: newApplication.acronym,
        environment: newApplication.environment,
      })
      .then((res) =>
        ResponseUtils.format({
          description: 'Application subscribed successfully',
          data: res,
          status: HttpStatus.CREATED,
        }),
      );
  }

  private validMultiplesEmails(...emails: string[][]): boolean {
    return emails.reduce(
      (acc, email) => this.validateEmail(email) || acc,
      false,
    );
  }

  private validateEmail(emails: string[]) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emailList = emails?.map((email) => email.trim());
    if (!emailList?.length) return false;
    for (const email of emailList) {
      if (!emailRegex.test(email)) {
        return false;
      }
    }
    return true;
  }
}
