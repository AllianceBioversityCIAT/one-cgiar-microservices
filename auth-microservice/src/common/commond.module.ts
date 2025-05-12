import { Module } from '@nestjs/common';
import { LoggingInterceptor } from './interceptors/logging.interceptor';

@Module({
  providers: [LoggingInterceptor],
  exports: [LoggingInterceptor],
})
export class CommonModule {}
