import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OpenaiModule } from './module/openai/openai.module';
import { MiningModule } from './module/mining/mining.module';
import { APP_FILTER, APP_INTERCEPTOR, RouterModule } from '@nestjs/core';
import { ClarisaModule } from './tools/clarisa/clarisa.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GlobalExceptions } from './shared/errors/global.exception';
import { LoggingInterceptor } from './shared/interceptors/logging.interceptor';
import { ResponseInterceptor } from './shared/interceptors/response.interceptor';
import { ENV } from './utils/env.utils';
import { routes as mainRoutes } from './routes/main.routes';
import { ThreadsModule } from './module/threads/threads.module';
import { MessagesModule } from './module/messages/messages.module';
import { AssistantModule } from './module/assistant/assistant.module';
import { JwtMiddleware } from './shared/middlewares/jwt.middleware';

@Module({
  imports: [
    OpenaiModule,
    MiningModule,
    AssistantModule,
    ThreadsModule,
    MessagesModule,
    RouterModule.register(mainRoutes),
    ClarisaModule,
    NotificationsModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
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
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptions,
    },
    {
      provide: ENV,
      useFactory: (configService: ConfigService) => new ENV(configService),
      inject: [ConfigService],
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(JwtMiddleware).forRoutes(
      {
        path: '/test-slack-notification',
        method: RequestMethod.ALL,
      },
    );
  }
}
