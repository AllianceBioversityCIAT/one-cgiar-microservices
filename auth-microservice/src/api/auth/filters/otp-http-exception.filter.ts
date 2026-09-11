import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Route-local exception filter for the EMAIL_OTP endpoints
 * (`login/otp/start`, `login/otp/verify`) — OTP-T-3, OTP-R-7, design.md §4.2
 * "Errors (stable codes)".
 *
 * The global `HttpExceptionFilter` (`main.ts`) rebuilds the error body from
 * `exception.message` only, which drops the stable `code` PRMS relies on
 * (`CODE_MISMATCH`, `CODE_EXPIRED`, `ATTEMPTS_EXCEEDED`, `NOT_AUTHORIZED`,
 * `CHALLENGE_NOT_SUPPORTED`, `UPSTREAM_ERROR`). Applied with `@UseFilters` on
 * the two OTP handlers only, this filter takes precedence over the global one
 * (Nest resolves method > controller > global) and serialises an object
 * response verbatim, keeping the shared `{ statusCode, path, timestamp }`
 * envelope. A string response yields exactly the shared filter's shape, so no
 * existing route or the shared filter is touched (OTP-R-10).
 *
 * Logging mirrors the shared filter (method, path, status, message, stack) and
 * NEVER includes the request body, which carries `session` and `code`.
 */
@Catch(HttpException)
export class OtpHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(OtpHttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const body =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? { statusCode: status, ...exceptionResponse }
        : {
            statusCode: status,
            message: exception.message || 'Internal server error',
          };

    const errorResponse = {
      ...body,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    this.logger.error(
      `${request.method} ${request.url} ${status} - ${exception.message}`,
      exception.stack,
    );

    response.status(status).json(errorResponse);
  }
}
