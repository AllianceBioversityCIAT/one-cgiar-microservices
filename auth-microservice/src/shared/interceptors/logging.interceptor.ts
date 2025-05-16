import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('LoggingInterceptor');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const { ip, method, originalUrl: url, body } = request;
    const userAgent = request.get('user-agent') || '';

    const requestId = `${Math.random().toString(36).substring(2, 15)}`;

    this.logger.log(
      `[Request ${requestId}] ${method} ${url} - IP: ${ip} - User-Agent: ${userAgent} - Body: ${JSON.stringify(body)}`,
    );

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: (data) => {
          const responseTime = Date.now() - startTime;
          this.logger.log(
            `[Response ${requestId}] ${method} ${url} ${response.statusCode} - ${responseTime}ms - Response: ${
              data ? JSON.stringify(data).substring(0, 1000) : 'No data'
            }`,
          );
        },
        error: (err) => {
          const responseTime = Date.now() - startTime;
          this.logger.error(
            `[Error ${requestId}] ${method} ${url} ${err.status || 500} - ${responseTime}ms - ${err.message}`,
            err.stack,
          );
        },
      }),
    );
  }
}
