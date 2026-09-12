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

/**
 * Keys whose values must never reach a log line (OTP-R-11, `.cursorrules`):
 * Cognito sessions, tokens, credentials and one-time codes. Matched
 * case-insensitively against each object key.
 */
const SENSITIVE_KEYS: ReadonlySet<string> = new Set([
  'session',
  'tokens',
  'accesstoken',
  'idtoken',
  'refreshtoken',
  'password',
  'temporarypassword',
  'secrethash',
  'code',
]);
const REDACTED = '[REDACTED]';
const MAX_DEPTH = 10;
const DEPTH_EXCEEDED = '[MAX_DEPTH]';

/**
 * Returns a deep copy of `value` with every sensitive key replaced by
 * `"[REDACTED]"`. Walks plain objects and arrays recursively (depth-capped,
 * so cyclic input terminates); primitives, `null` and `Date` pass through.
 * Never mutates the input.
 */
export function redactSensitive(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== 'object' || value instanceof Date) {
    return value;
  }
  if (depth >= MAX_DEPTH) {
    return DEPTH_EXCEEDED;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, depth + 1));
  }
  const copy: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    copy[key] = SENSITIVE_KEYS.has(key.toLowerCase())
      ? REDACTED
      : redactSensitive(entry, depth + 1);
  }
  return copy;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('LoggingInterceptor');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const { ip, method, originalUrl: url } = request;
    const userAgent = request.get('user-agent') || '';

    const requestId = `${Math.random().toString(36).substring(2, 15)}`;

    this.logger.log(
      `[Request ${requestId}] ${method} ${url} - IP: ${ip} - User-Agent: ${userAgent}}`,
    );

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: (data) => {
          const responseTime = Date.now() - startTime;
          this.logger.log(
            `[Response ${requestId}] ${method} ${url} ${response.statusCode} - ${responseTime}ms - Response: ${
              data
                ? JSON.stringify(redactSensitive(data)).substring(0, 1000)
                : 'No data'
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
