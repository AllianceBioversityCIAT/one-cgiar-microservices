import { Module } from '@nestjs/common';
import { ThreadsService } from './threads.service';
import { ThreadsController } from './threads.controller';
import { OpenaiService } from '../openai/openai.service';

@Module({
  controllers: [ThreadsController],
  providers: [ThreadsService, OpenaiService],
})
export class ThreadsModule {}
