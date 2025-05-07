import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MailerModule } from './domain/api/mailer/mailer.module';
import { APP_FILTER, APP_INTERCEPTOR, RouterModule } from '@nestjs/core';
import { GlobalExceptions } from './domain/shared/error-management/global.exception';
import { ResponseInterceptor } from './domain/shared/Interceptors/response.interceptor';
import { LoggingInterceptor } from './domain/shared/Interceptors/logging.interceptor';
import { JwtMiddleware } from './domain/shared/middlewares/jwr.middleware';
import { routes as mainRoutes } from './domain/routes/main.routes';
import { ClarisaModule } from './domain/tools/clarisa/clarisa.module';
import { SlackService } from './domain/tools/slack/slack.service';
@Module({
  imports: [MailerModule, RouterModule.register(mainRoutes), ClarisaModule],
  controllers: [AppController],
  providers: [
    AppService,
    SlackService,
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
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(JwtMiddleware).forRoutes({
      path: 'api/email/send',
      method: RequestMethod.ALL,
    });
  }
}
