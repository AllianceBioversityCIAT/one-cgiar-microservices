import { Module } from '@nestjs/common';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { HttpExceptionFilter } from './filters/http-exception.filter';

/**
 * Common module that provides shared services, interceptors, and filters
 */
@Module({
  providers: [LoggingInterceptor, HttpExceptionFilter],
  exports: [LoggingInterceptor, HttpExceptionFilter],
})
export class CommonModule {}
