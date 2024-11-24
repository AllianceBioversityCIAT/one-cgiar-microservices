import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OpenaiModule } from './module/openai/openai.module';
import { AssistantModule } from './module/assistant/assistant.module';
import { ThreadsModule } from './module/threads/threads.module';
import { MessagesModule } from './module/messages/messages.module';
import { DynamoModule } from './connection/dynamo/dynamo.module';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, RouterModule } from '@nestjs/core';
import { MainRoutes } from './main.routes';
import { LoggingInterceptor } from './common/interceptor/loggin.interceptor';
import { GlobalExceptions } from './common/error/global.exceptions';
import { ResponseInterceptor } from './common/interceptor/response.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    RouterModule.register(MainRoutes),
    OpenaiModule,
    AssistantModule,
    ThreadsModule,
    MessagesModule,
    DynamoModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptions
    }
  ],
})
export class AppModule {}
