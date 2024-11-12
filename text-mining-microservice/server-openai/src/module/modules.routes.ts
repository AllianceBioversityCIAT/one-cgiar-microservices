import { Routes } from '@nestjs/core';
import { AssistantModule } from './assistant/assistant.module';
import { ThreadsModule } from './threads/threads.module';

export const ModulesRoutes: Routes = [
  {
    path: 'assistant',
    module: AssistantModule,
  },
  {
    path: 'thread',
    module: ThreadsModule,
  },
];
