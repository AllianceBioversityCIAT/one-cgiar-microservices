import { of, throwError } from 'rxjs';
import { CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { LoggingInterceptor } from './logging.interceptor';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let mockContext: ExecutionContext;
  let mockHandler: CallHandler;

  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    interceptor = new LoggingInterceptor();

    mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          originalUrl: '/test-url',
          ip: '127.0.0.1',
          get: (header: string) =>
            header === 'user-agent' ? 'test-user-agent' : null,
          body: { test: 'data' },
        }),
        getResponse: () => ({
          statusCode: 200,
        }),
      }),
    } as ExecutionContext;

    mockHandler = {
      handle: () => of({ result: 'success' }),
    };

    jest.spyOn(Logger.prototype, 'log').mockImplementation(mockLogger.log);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(mockLogger.error);

    jest.spyOn(Math, 'random').mockReturnValue(0.123456789);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should log request and response information', (done) => {
    interceptor.intercept(mockContext, mockHandler).subscribe({
      next: (value) => {
        expect(value).toEqual({ result: 'success' });

        expect(mockLogger.log).toHaveBeenCalledTimes(2);

        expect(mockLogger.log.mock.calls[0][0]).toContain('[Request');
        expect(mockLogger.log.mock.calls[0][0]).toContain('GET /test-url');
        expect(mockLogger.log.mock.calls[0][0]).toContain('127.0.0.1');
        expect(mockLogger.log.mock.calls[0][0]).toContain('test-user-agent');

        expect(mockLogger.log.mock.calls[1][0]).toContain('[Response');
        expect(mockLogger.log.mock.calls[1][0]).toContain('GET /test-url 200');
        expect(mockLogger.log.mock.calls[1][0]).toContain(
          '{"result":"success"}',
        );

        done();
      },
      error: (err) => done(err),
    });
  });

  it('should log error information when exception occurs', (done) => {
    const errorHandler: CallHandler = {
      handle: () => throwError(() => new Error('Test error')),
    };

    interceptor.intercept(mockContext, errorHandler).subscribe({
      next: () => done(new Error('Should not reach here')),
      error: (err) => {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('Test error');

        expect(mockLogger.error).toHaveBeenCalledTimes(1);

        expect(mockLogger.error.mock.calls[0][0]).toContain('[Error');
        expect(mockLogger.error.mock.calls[0][0]).toContain('GET /test-url');
        expect(mockLogger.error.mock.calls[0][0]).toContain('Test error');

        done();
      },
    });
  });

  it('should truncate large response bodies in logs', (done) => {
    const largeResponseHandler: CallHandler = {
      handle: () => of({ largeData: 'a'.repeat(2000) }),
    };

    interceptor.intercept(mockContext, largeResponseHandler).subscribe({
      next: () => {
        const responseLog = mockLogger.log.mock.calls[1][0];
        expect(responseLog.length).toBeLessThan(2000);
        expect(responseLog).toContain('{"largeData":"');

        done();
      },
      error: (err) => done(err),
    });
  });

  it('should handle missing body gracefully', (done) => {
    const noBodyContext = {
      ...mockContext,
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          originalUrl: '/test-url',
          ip: '127.0.0.1',
          get: () => null,
        }),
        getResponse: () => ({
          statusCode: 200,
        }),
      }),
    } as unknown as ExecutionContext;

    interceptor.intercept(noBodyContext, mockHandler).subscribe({
      next: () => {
        expect(mockLogger.log).toHaveBeenCalledTimes(2);

        done();
      },
      error: (err) => done(err),
    });
  });
});
