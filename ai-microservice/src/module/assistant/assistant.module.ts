import { Module } from '@nestjs/common';
import { AssistantService } from './assistant.service';
import { OpenaiService } from '../openai/openai.service';

@Module({
  providers: [AssistantService, OpenaiService],
  exports: [AssistantService],
})
export class AssistantModule {}
