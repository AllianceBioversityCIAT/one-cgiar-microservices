import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global HTTP exception filter to standardize error responses
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    
    const errorResponse = {
      statusCode: status,
      message: exception.message || 'Internal server error',
      path: request.url,
      timestamp: new Date().toISOString(),
    };
    
    this.logger.error(
      `${request.method} ${request.url} ${status} - ${exception.message}`,
      exception.stack,
    );

    response
      .status(status)
      .json(errorResponse);
  }
}
