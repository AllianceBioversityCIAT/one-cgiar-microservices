import { Module } from '@nestjs/common';
import { MiningService } from './mining.service';
import { MiningController } from './mining.controller';
import { ThreadsModule } from '../threads/threads.module';
import { OpenaiModule } from '../openai/openai.module';
import { AssistantModule } from '../assistant/assistant.module';
import { MessagesModule } from '../messages/messages.module';
import { NotificationsModule } from '../../notifications/notifications.module';

@Module({
  controllers: [MiningController],
  providers: [MiningService],
  imports: [
    OpenaiModule,
    AssistantModule,
    ThreadsModule,
    MessagesModule,
    NotificationsModule,
  ],
  exports: [MiningService],
})
export class MiningModule {}
