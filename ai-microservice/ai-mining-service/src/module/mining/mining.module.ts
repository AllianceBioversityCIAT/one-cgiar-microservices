import { Module } from '@nestjs/common';
import { MiningService } from './mining.service';
import { MiningController } from './mining.controller';
import { ThreadsModule } from '../threads/threads.module';
import { OpenaiModule } from '../openai/openai.module';
import { AssistantModule } from '../assistant/assistant.module';
import { MessagesModule } from '../messages/messages.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { ClarisaModule } from '../../tools/clarisa/clarisa.module';
import { Test } from '../../tools/broker-connection/test';

@Module({
  controllers: [MiningController],
  providers: [MiningService, Test],
  imports: [
    OpenaiModule,
    AssistantModule,
    ThreadsModule,
    MessagesModule,
    NotificationsModule,
    ClarisaModule,
  ],
  exports: [MiningService],
})
export class MiningModule {}
