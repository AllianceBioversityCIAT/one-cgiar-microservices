import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { MailerService } from './mailer.service';
import { MailerModule } from './mailer.module';
import { ConfigMessageDto } from '../../shared/global-dto/mailer.dto';
import { HttpStatus } from '@nestjs/common';
import { env } from 'process';

describe('MailerService', () => {
  let service: MailerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [],
      imports: [MailerModule],
    }).compile();

    service = module.get<MailerService>(MailerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should send email', async () => {
    const messageBody: ConfigMessageDto = {
      from: {
        email: 'test.domain@email.com',
        name: 'Test One CGIAR Notification',
      },
      emailBody: {
        subject: 'Prueba HTML REAL no Fake 2',
        to: 'to.testing@email.com',
        cc: 'cc.testing@email.com',
        bcc: null,
        message: {
          text: 'string',
          file: null,
        },
      },
    };
    const spyResData = {
      accepted: [messageBody.emailBody.to, messageBody.emailBody.cc],
      rejected: [],
      ehlo: [
        'PIPELINING',
        'SIZE 35000000',
        'VRFY',
        'ETRN',
        'STARTTLS',
        'ENHANCEDSTATUSCODES',
        '8BITMIME',
        'DSN',
        'CHUNKING',
      ],
      envelopeTime: 82,
      messageTime: 104,
      messageSize: 6342,
      response: '250 2.0.0 Ok: queued as 44CDB13ECDC',
      envelope: {
        from: messageBody.from.email,
        to: [messageBody.emailBody.to, messageBody.emailBody.cc],
      },
      messageId: '<19ca5e99-a110-c46c-6d16-dd0fb821513d@email.org>',
    };
    jest
      .spyOn(service['transporter'], 'sendMail')
      .mockResolvedValue(Promise.resolve(spyResData as any));
    const responde = await service.sendMail(messageBody);
    expect(responde.status).toBe(HttpStatus.CREATED);
    expect(responde.description).toBe('Email sent successfully');
    expect(responde.data).toBe(spyResData);
  });

  it('should send email', async () => {
    const messageBody: ConfigMessageDto = {
      from: null,
      emailBody: {
        subject: null,
        to: 'to.testing@email.com',
        cc: 'cc.testing@email.com',
        bcc: null,
        message: {
          text: 'string',
          file: null,
        },
      },
    };
    const spyResData = {
      accepted: [messageBody.emailBody.to, messageBody.emailBody.cc],
      rejected: [],
      ehlo: [
        'PIPELINING',
        'SIZE 35000000',
        'VRFY',
        'ETRN',
        'STARTTLS',
        'ENHANCEDSTATUSCODES',
        '8BITMIME',
        'DSN',
        'CHUNKING',
      ],
      envelopeTime: 82,
      messageTime: 104,
      messageSize: 6342,
      response: '250 2.0.0 Ok: queued as 44CDB13ECDC',
      envelope: {
        from: env.EMAIL_ROOT,
        to: [messageBody.emailBody.to, messageBody.emailBody.cc],
      },
      messageId: '<19ca5e99-a110-c46c-6d16-dd0fb821513d@email.org>',
    };
    jest
      .spyOn(service['transporter'], 'sendMail')
      .mockResolvedValue(Promise.resolve(spyResData as any));
    const responde = await service.sendMail(messageBody);
    expect(responde.status).toBe(HttpStatus.CREATED);
    expect(responde.description).toBe('Email sent successfully');
    expect(responde.data).toBe(spyResData);
  });
  it('should error ', async () => {
    const messageBody: ConfigMessageDto = {
      from: null,
      emailBody: {
        subject: null,
        to: 'to.testing@email.com',
        cc: 'cc.testing@email.com',
        bcc: null,
        message: {
          text: 'string',
          file: null,
        },
      },
    };
    const spyResData = {
      accepted: [messageBody.emailBody.to, messageBody.emailBody.cc],
      rejected: [],
      ehlo: [
        'PIPELINING',
        'SIZE 35000000',
        'VRFY',
        'ETRN',
        'STARTTLS',
        'ENHANCEDSTATUSCODES',
        '8BITMIME',
        'DSN',
        'CHUNKING',
      ],
      envelopeTime: 82,
      messageTime: 104,
      messageSize: 6342,
      response: '250 2.0.0 Ok: queued as 44CDB13ECDC',
      envelope: {
        from: env.EMAIL_ROOT,
        to: [messageBody.emailBody.to, messageBody.emailBody.cc],
      },
      messageId: '<19ca5e99-a110-c46c-6d16-dd0fb821513d@email.org>',
    };
    jest
      .spyOn(service['transporter'], 'sendMail')
      .mockResolvedValue(Promise.resolve(spyResData as any));
    const responde = await service.sendMail(messageBody);
    expect(responde.status).toBe(HttpStatus.CREATED);
    expect(responde.description).toBe('Email sent successfully');
    expect(responde.data).toBe(spyResData);
  });
});
