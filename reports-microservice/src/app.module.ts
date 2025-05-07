import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, RouterModule } from '@nestjs/core';
import { routes as mainRoutes } from './domain/routes/main.routes';
import { AppService } from './app.service';
import { AppController } from './app.controller';
import { PdfModule } from './domain/api/pdf/pdf.module';
import { LoggingInterceptor } from './domain/shared/interceptors/logging.interceptor';
import { ResponseInterceptor } from './domain/shared/interceptors/response.interceptor';
import { GlobalExceptions } from './domain/shared/errors/global.exception';
import { JwtMiddleware } from './domain/shared/middlewares/jwt.middleware';
import { ClarisaModule } from './domain/tools/clarisa/clarisa.module';
import { NotificationsModule } from './domain/notifications/notifications.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ENV } from './domain/utils/env.utils';

@Module({
  imports: [
    PdfModule,
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
        path: '/api/reports/pdf/generate',
        method: RequestMethod.ALL,
      },
      {
        path: '/test-slack-notification',
        method: RequestMethod.ALL,
      },
    );
  }
}
