import { Module } from '@nestjs/common';
import { MailerService } from './mailer.service';
import { MailerController } from './mailer.controller';
import { RabbitMQService } from '../../tools/rabbitmq/rabbitmq.service';
import { ClarisaModule } from '../../tools/clarisa/clarisa.module';
import { HttpModule } from '@nestjs/axios';
import { CustomLogger } from '../../shared/utils/logger.utils';
import { SlackService } from '../../tools/slack/slack.service';

@Module({
  controllers: [MailerController],
  providers: [MailerService, RabbitMQService, CustomLogger, SlackService],
  exports: [MailerService],
  imports: [ClarisaModule, HttpModule],
})
export class MailerModule {}
