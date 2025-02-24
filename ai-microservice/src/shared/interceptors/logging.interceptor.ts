import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { Request } from 'express';
import { ENV } from '../../utils/env.utils';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly _logger: Logger = new Logger('System');

  constructor(private readonly env: ENV) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request: Request = ctx.getRequest<Request>();
    const ip = request.socket?.remoteAddress || 'Microservice';

    try {
      return next
        .handle()
        .pipe(
          finalize(
            () =>
              this.env.SEE_ALL_LOGS &&
              this._logger.log(
                `[${request.method}]: ${request.url} - By ${ip}`,
              ),
          ),
        );
    } catch (error) {
      this._logger.error(error);
      throw error;
    }
  }
}
