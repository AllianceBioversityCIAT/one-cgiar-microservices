import { Module } from '@nestjs/common';
import { ThreadsService } from './threads.service';
import { OpenaiService } from '../openai/openai.service';

@Module({
  providers: [ThreadsService, OpenaiService],
  exports: [ThreadsService],
})
export class ThreadsModule {}
