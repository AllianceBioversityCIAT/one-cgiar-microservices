import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { OpenaiService } from '../openai/openai.service';

@Module({
  providers: [MessagesService, OpenaiService],
  exports: [MessagesService],
})
export class MessagesModule {}
