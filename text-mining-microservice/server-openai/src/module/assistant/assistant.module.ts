import { Module } from '@nestjs/common';
import { AssistantService } from './assistant.service';
import { AssistantController } from './assistant.controller';
import { OpenaiService } from '../openai/openai.service';

@Module({
  controllers: [AssistantController],
  providers: [AssistantService, OpenaiService],
  exports: [],
})
export class AssistantModule {}
