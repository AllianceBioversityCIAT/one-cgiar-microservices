import { of, throwError } from 'rxjs';
import { CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { LoggingInterceptor, redactSensitive } from './logging.interceptor';

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

  describe('log hygiene (OTP-R-11): sensitive keys never reach the log line', () => {
    const FAKE_SESSION = 'FAKE-OTP-SESSION-' + 'x'.repeat(1600);
    const FAKE_ACCESS = 'FAKE-ACCESS-TOKEN-' + 'a'.repeat(1000);
    const FAKE_ID = 'FAKE-ID-TOKEN-' + 'i'.repeat(200);
    const FAKE_REFRESH = 'FAKE-REFRESH-TOKEN-' + 'r'.repeat(200);

    it('logs [REDACTED] instead of the session on a start-like response', (done) => {
      const handler: CallHandler = {
        handle: () =>
          of({
            challengeName: 'EMAIL_OTP',
            session: FAKE_SESSION,
            codeDeliveryDestination: 'u***@icrisat.org',
          }),
      };

      interceptor.intercept(mockContext, handler).subscribe({
        next: () => {
          const responseLog: string = mockLogger.log.mock.calls[1][0];
          expect(responseLog).toContain('[Response');
          expect(responseLog).toContain('"session":"[REDACTED]"');
          expect(responseLog).toContain('"challengeName":"EMAIL_OTP"');
          expect(responseLog).not.toContain('FAKE-OTP-SESSION');
          done();
        },
        error: (err) => done(err),
      });
    });

    it('logs [REDACTED] instead of the tokens object on a verify-like response', (done) => {
      const handler: CallHandler = {
        handle: () =>
          of({
            tokens: {
              accessToken: FAKE_ACCESS,
              idToken: FAKE_ID,
              refreshToken: FAKE_REFRESH,
              expiresIn: 3600,
              tokenType: 'Bearer',
            },
          }),
      };

      interceptor.intercept(mockContext, handler).subscribe({
        next: () => {
          const responseLog: string = mockLogger.log.mock.calls[1][0];
          expect(responseLog).toContain('"tokens":"[REDACTED]"');
          expect(responseLog).not.toContain('FAKE-ACCESS-TOKEN');
          expect(responseLog).not.toContain('FAKE-ID-TOKEN');
          expect(responseLog).not.toContain('FAKE-REFRESH-TOKEN');
          done();
        },
        error: (err) => done(err),
      });
    });

    it('does not mutate the handler result that flows to the client', (done) => {
      const payload = {
        challengeName: 'EMAIL_OTP',
        session: FAKE_SESSION,
        nested: { tokens: { accessToken: FAKE_ACCESS } },
      };
      const snapshot = JSON.stringify(payload);
      const handler: CallHandler = { handle: () => of(payload) };

      interceptor.intercept(mockContext, handler).subscribe({
        next: (value) => {
          expect(value).toBe(payload);
          expect(JSON.stringify(payload)).toBe(snapshot);
          expect(payload.session).toBe(FAKE_SESSION);
          expect(payload.nested.tokens.accessToken).toBe(FAKE_ACCESS);
          done();
        },
        error: (err) => done(err),
      });
    });
  });
});

describe('redactSensitive', () => {
  it('replaces every sensitive key (case-insensitive) at any depth with [REDACTED]', () => {
    const input = {
      session: 's',
      Tokens: { accessToken: 'a', IdToken: 'i', REFRESHTOKEN: 'r' },
      user: {
        password: 'p',
        temporaryPassword: 't',
        secretHash: 'h',
        code: '12345678',
        profile: { AccessToken: 'deep' },
      },
    };

    expect(redactSensitive(input)).toEqual({
      session: '[REDACTED]',
      Tokens: '[REDACTED]',
      user: {
        password: '[REDACTED]',
        temporaryPassword: '[REDACTED]',
        secretHash: '[REDACTED]',
        code: '[REDACTED]',
        profile: { AccessToken: '[REDACTED]' },
      },
    });
  });

  it('leaves non-sensitive keys and values intact', () => {
    const input = {
      challengeName: 'EMAIL_OTP',
      codeDeliveryDestination: 'u***@icrisat.org',
      expiresIn: 3600,
      ok: true,
      nothing: null,
      list: [1, 'two', { three: 3 }],
    };

    expect(redactSensitive(input)).toEqual(input);
  });

  it('walks arrays and redacts inside their elements', () => {
    expect(
      redactSensitive([
        { session: 's', keep: 1 },
        'plain',
        { list: [{ code: 'c' }] },
      ]),
    ).toEqual([
      { session: '[REDACTED]', keep: 1 },
      'plain',
      { list: [{ code: '[REDACTED]' }] },
    ]);
  });

  it('returns null and primitives unchanged', () => {
    expect(redactSensitive(null)).toBeNull();
    expect(redactSensitive(undefined)).toBeUndefined();
    expect(redactSensitive('string')).toBe('string');
    expect(redactSensitive(42)).toBe(42);
    expect(redactSensitive(false)).toBe(false);
  });

  it('returns a copy and never mutates the input', () => {
    const input = {
      session: 's',
      nested: { tokens: { accessToken: 'a' } },
      list: [{ code: 'c' }],
    };
    const snapshot = JSON.stringify(input);

    const out = redactSensitive(input) as typeof input;

    expect(out).not.toBe(input);
    expect(out.nested).not.toBe(input.nested);
    expect(out.list).not.toBe(input.list);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('stops at the depth cap instead of recursing forever', () => {
    let deep: Record<string, unknown> = { session: 'leaf' };
    for (let i = 0; i < 30; i++) {
      deep = { level: deep };
    }
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;

    expect(() => redactSensitive(deep)).not.toThrow();
    expect(() => redactSensitive(cyclic)).not.toThrow();
    expect(JSON.stringify(redactSensitive(deep))).not.toContain('leaf');
    expect(() => JSON.stringify(redactSensitive(cyclic))).not.toThrow();
  });
});
