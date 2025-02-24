import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { OpenaiService } from '../openai/openai.service';
import { FileModule } from '../file/file.module';

@Module({
  providers: [MessagesService, OpenaiService],
  exports: [MessagesService],
  imports: [FileModule],
})
export class MessagesModule {}
