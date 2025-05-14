import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './api/auth/auth.module';
import { CommonModule } from './shared/common.module';
import { JwtClarisaMiddleware } from './middleware/jwt-clarisa.middleware';
import { ClarisaModule } from './tools/clarisa/clarisa.module';

@Module({
  imports: [
    AuthModule,
    CommonModule,
    ClarisaModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(JwtClarisaMiddleware).forRoutes({
      path: '/auth/*path',
      method: RequestMethod.ALL,
    });
  }
}
