import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { APP_FILTER, APP_INTERCEPTOR, RouterModule } from '@nestjs/core';
import { MainRoutes } from './main.routes';
import { FileManagementModule } from './api/file-management/file-management.module';
import { ClarisaModule } from './tools/clarisa/clarisa.module';
import { GlobalExceptions } from './errors/global.exception';
import { LoggingInterceptor } from './shared/interceptors/logging.interceptor';
import { JwtMiddleware } from './middleware/jwt.middleware';
import { NotificationsModule } from './api/notifications/notifications.module';
import { PdfModule } from './api/pdf/pdf.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    RouterModule.register(MainRoutes),
    FileManagementModule,
    ClarisaModule,
    NotificationsModule,
    PdfModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptions,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(JwtMiddleware).forRoutes(
      {
        path: '/api/file-management/validation',
        method: RequestMethod.ALL,
      },
      {
        path: '/api/file-management/upload',
        method: RequestMethod.ALL,
      },
      {
        path: '/api/file-management/delete',
        method: RequestMethod.ALL,
      },
    );
  }
}
