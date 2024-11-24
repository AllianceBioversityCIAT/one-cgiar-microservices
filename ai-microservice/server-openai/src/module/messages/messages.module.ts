import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { OpenaiService } from '../openai/openai.service';

@Module({
  controllers: [MessagesController],
  providers: [MessagesService, OpenaiService],
})
export class MessagesModule {}
