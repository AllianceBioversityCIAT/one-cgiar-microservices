import {
  Body,
  Controller,
  Headers,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ConfigMessageDto,
  ConfigMessageSocketDto,
} from '../../shared/global-dto/mailer.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiHeader } from '@nestjs/swagger';
import { MailerService } from './mailer.service';
import { SearchRequest } from '../../shared/decorators/search-request.decorator';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SubscribeApplicationDto } from './dto/ubscribe-application.dto';
import { ResClarisaValidateConectioDto } from '../../tools/clarisa/dtos/clarisa-create-conection.dto';
import { AuthInterceptor } from '../../shared/Interceptors/microservices.interceptor';
import { RabbitMQService } from '../../tools/rabbitmq/rabbitmq.service';
import { AuthorizationDto } from '../../shared/global-dto/auth.dto';
import { ResponseUtils } from '../../shared/utils/response.utils';

@Controller()
export class MailerController {
  constructor(
    private readonly _mailerService: MailerService,
    private readonly _rabbitMQService: RabbitMQService,
  ) {}

  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File to upload',
        },
        from: {
          type: 'object',
          properties: {
            email: { type: 'string' },
            name: { type: 'string', nullable: true },
          },
        },
        emailBody: {
          type: 'object',
          properties: {
            subject: { type: 'string' },
            to: {
              type: 'string',
            },
            cc: {
              type: 'string',
              nullable: true,
            },
            bcc: {
              type: 'string',
              nullable: true,
            },
            message: {
              type: 'object',
              properties: {
                text: { type: 'string', nullable: true },
                file: { type: 'string', nullable: true },
              },
            },
          },
        },
      },
    },
  })
  @ApiHeader({
    name: 'auth',
    description:
      'Custom header containing the encoded AuthorizationDto (username and password)',
    required: true,
    schema: {
      type: 'string',
      example: '{"username": "user", "password": "pass"}',
    },
  })
  @Post('send')
  @UseInterceptors(FileInterceptor('file'))
  async sendMail(
    @UploadedFile() file: Express.Multer.File,
    @Body() configMessageDto: ConfigMessageDto,
    @SearchRequest('application') appConect: ResClarisaValidateConectioDto,
    @Headers('auth') header: string,
  ) {
    const temp = configMessageDto;
    temp.emailBody = JSON.parse(String(configMessageDto.emailBody));
    temp.from = JSON.parse(String(configMessageDto.from));
    temp.environment = appConect.receiver_mis.environment;
    temp.sender = appConect;
    const tempHeader: AuthorizationDto = JSON.parse(header);

    if (file && file?.mimetype === 'text/html') {
      temp.emailBody.message.socketFile = file.buffer;
    } else {
      temp.emailBody.message.file = null;
    }
    const sendMessage: ConfigMessageSocketDto = {
      application: appConect,
      auth: tempHeader,
      data: temp,
    };
    this._rabbitMQService.emitToPattern<ConfigMessageSocketDto>(
      'send',
      sendMessage,
    );
    return ResponseUtils.format({
      description: 'The email is being sent',
      data: {
        from: temp.from,
        subject: temp.emailBody.subject,
        environment: temp.sender.receiver_mis.environment,
        sender: temp.sender.sender_mis.acronym,
      },
      status: HttpStatus.ACCEPTED,
    });
  }

  @MessagePattern('send')
  @UseInterceptors(AuthInterceptor)
  async handleIncomingMessage(@Payload() payload: ConfigMessageSocketDto) {
    const file = payload.data?.emailBody?.message?.socketFile;
    if (typeof file === 'string') {
      payload.data.emailBody.message.file = Buffer.from(file);
    } else if (file) {
      payload.data.emailBody.message.file = file;
    } else {
      payload.data.emailBody.message.file = null;
    }
    const message = payload.data;
    return this._mailerService.sendMail(message);
  }

  @Post('subscribe-application')
  subscribeApplication(@Body() newApplication: SubscribeApplicationDto) {
    return this._mailerService.subscribeApplication(newApplication);
  }
}
