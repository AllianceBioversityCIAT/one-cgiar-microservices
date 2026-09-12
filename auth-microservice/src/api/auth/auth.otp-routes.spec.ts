import { Test, TestingModule } from '@nestjs/testing';
import {
  HttpException,
  HttpStatus,
  INestApplication,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import * as request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { BulkUserService } from './services/bulk-registration/bulk-registration.service';
import { UserService } from './services/user/user.service';
import { EXCEPTION_FILTERS_METADATA } from '@nestjs/common/constants';
import { HttpExceptionFilter } from '../../shared/filters/http-exception.filter';
import { LoggingInterceptor } from '../../shared/interceptors/logging.interceptor';

/**
 * OTP-T-3 rework — request-level proof that the stable error `code` reaches the
 * wire on `login/otp/start` and `login/otp/verify` even though `main.ts`
 * registers the shared `HttpExceptionFilter` globally (OTP-R-7, design.md §4.2
 * "Errors (stable codes)"). The app is wired exactly like `main.ts`:
 * `useGlobalPipes(new ValidationPipe())` + `useGlobalInterceptors(new LoggingInterceptor())`
 * + `useGlobalFilters(new HttpExceptionFilter())`.
 * No global prefix is set in `main.ts`, so the routes are `/auth/login/otp/*`.
 *
 * Rework attempt 3 also proves OTP-R-11 at the request level: the global
 * `LoggingInterceptor` logs the handler result on success, so the session and
 * the tokens must be redacted before they reach the log line.
 */
describe('AuthController OTP routes (request-level, OTP-R-7)', () => {
  let app: INestApplication;
  let authService: jest.Mocked<
    Pick<AuthService, 'startEmailOtp' | 'verifyEmailOtp'>
  >;

  const mockAuthResult = {
    tokens: {
      accessToken: 'mock-access-token',
      idToken: 'mock-id-token',
      refreshToken: 'mock-refresh-token',
      expiresIn: 3600,
      tokenType: 'Bearer',
    },
  };

  beforeAll(async () => {
    authService = {
      startEmailOtp: jest.fn(),
      verifyEmailOtp: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: BulkUserService, useValue: {} },
        { provide: UserService, useValue: {} },
      ],
    }).compile();

    app = moduleFixture.createNestApplication({ logger: false });
    app.useGlobalPipes(new ValidationPipe());
    app.useGlobalInterceptors(new LoggingInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/login/otp/verify', () => {
    it('keeps `code: CODE_MISMATCH` in the 401 body', async () => {
      authService.verifyEmailOtp.mockRejectedValue(
        new HttpException(
          { code: 'CODE_MISMATCH', message: 'The code entered is incorrect.' },
          HttpStatus.UNAUTHORIZED,
        ),
      );

      const res = await request(app.getHttpServer())
        .post('/auth/login/otp/verify')
        .send({
          username: 'user@icrisat.org',
          code: '12345678',
          session: 'AYABe',
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('CODE_MISMATCH');
      expect(res.body).toEqual(
        expect.objectContaining({
          statusCode: 401,
          code: 'CODE_MISMATCH',
          message: 'The code entered is incorrect.',
          path: '/auth/login/otp/verify',
          timestamp: expect.any(String),
        }),
      );
    });

    it('keeps `code: CODE_MISMATCH` AND the rotated `session` in the 401 body through the real OtpHttpExceptionFilter (OTP-R-7 modified, OTP-R-4), and never logs the rotated session (OTP-R-11)', async () => {
      const ROTATED_SESSION = 'rotated-session-value';

      const logSpy = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => undefined);
      const errorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      const warnSpy = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);

      try {
        authService.verifyEmailOtp.mockRejectedValue(
          new HttpException(
            {
              code: 'CODE_MISMATCH',
              message: 'The code entered is incorrect.',
              session: ROTATED_SESSION,
            },
            HttpStatus.UNAUTHORIZED,
          ),
        );

        const res = await request(app.getHttpServer())
          .post('/auth/login/otp/verify')
          .send({
            username: 'user@icrisat.org',
            code: '12345678',
            session: 'AYABe',
          });

        expect(res.status).toBe(401);
        expect(res.body).toEqual(
          expect.objectContaining({
            statusCode: 401,
            code: 'CODE_MISMATCH',
            message: 'The code entered is incorrect.',
            session: ROTATED_SESSION,
            path: '/auth/login/otp/verify',
            timestamp: expect.any(String),
          }),
        );
        expect(res.body.session).toBe(ROTATED_SESSION);

        const allCalls = [
          ...logSpy.mock.calls,
          ...errorSpy.mock.calls,
          ...warnSpy.mock.calls,
        ];
        expect(allCalls.length).toBeGreaterThan(0);
        const loggedText = allCalls
          .flat()
          .map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg)));
        expect(loggedText).not.toEqual(
          expect.arrayContaining([expect.stringContaining(ROTATED_SESSION)]),
        );
      } finally {
        logSpy.mockRestore();
        errorSpy.mockRestore();
        warnSpy.mockRestore();
      }
    });

    it.each([
      'CODE_EXPIRED',
      'ATTEMPTS_EXCEEDED',
      'NOT_AUTHORIZED',
      'CHALLENGE_NOT_SUPPORTED',
    ])('keeps `code: %s` in the 401 body', async (code) => {
      authService.verifyEmailOtp.mockRejectedValue(
        new HttpException(
          { code, message: 'stable copy' },
          HttpStatus.UNAUTHORIZED,
        ),
      );

      const res = await request(app.getHttpServer())
        .post('/auth/login/otp/verify')
        .send({
          username: 'user@icrisat.org',
          code: '12345678',
          session: 'AYABe',
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe(code);
    });

    it('returns 201 with the service result unchanged on success (same shape as login/custom)', async () => {
      authService.verifyEmailOtp.mockResolvedValue(mockAuthResult);

      const res = await request(app.getHttpServer())
        .post('/auth/login/otp/verify')
        .send({
          username: 'user@icrisat.org',
          code: '12345678',
          session: 'AYABe',
        });

      expect(res.status).toBe(201);
      expect(res.body).toEqual(mockAuthResult);
      expect(authService.verifyEmailOtp).toHaveBeenCalledWith({
        username: 'user@icrisat.org',
        code: '12345678',
        session: 'AYABe',
      });
    });

    it('still rejects an invalid DTO with 400 (ValidationPipe stays active)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login/otp/verify')
        .send({ username: 'user@icrisat.org', code: 'abc' });

      expect(res.status).toBe(400);
      expect(res.body.statusCode).toBe(400);
      expect(authService.verifyEmailOtp).not.toHaveBeenCalled();
    });
  });

  describe('POST /auth/login/otp/start', () => {
    it('keeps `code: UPSTREAM_ERROR` in the 502 body', async () => {
      authService.startEmailOtp.mockRejectedValue(
        new HttpException(
          { code: 'UPSTREAM_ERROR', message: 'Cognito could not be reached.' },
          HttpStatus.BAD_GATEWAY,
        ),
      );

      const res = await request(app.getHttpServer())
        .post('/auth/login/otp/start')
        .send({ username: 'user@icrisat.org' });

      expect(res.status).toBe(502);
      expect(res.body).toEqual(
        expect.objectContaining({
          statusCode: 502,
          code: 'UPSTREAM_ERROR',
          message: 'Cognito could not be reached.',
          path: '/auth/login/otp/start',
        }),
      );
    });

    it('keeps `code: CHALLENGE_NOT_SUPPORTED` in the 401 body', async () => {
      authService.startEmailOtp.mockRejectedValue(
        new HttpException(
          { code: 'CHALLENGE_NOT_SUPPORTED', message: 'stable copy' },
          HttpStatus.UNAUTHORIZED,
        ),
      );

      const res = await request(app.getHttpServer())
        .post('/auth/login/otp/start')
        .send({ username: 'user@icrisat.org' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('CHALLENGE_NOT_SUPPORTED');
    });

    it('returns 201 with the service result unchanged on success', async () => {
      const started = {
        challengeName: 'CUSTOM_CHALLENGE' as const,
        session: 'AYABe-new',
        codeDeliveryDestination: 'u***@icrisat.org',
      };
      authService.startEmailOtp.mockResolvedValue(started);

      const res = await request(app.getHttpServer())
        .post('/auth/login/otp/start')
        .send({ username: 'user@icrisat.org' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual(started);
    });

    it('still rejects an invalid DTO with 400 (ValidationPipe stays active)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login/otp/start')
        .send({ username: 'not-an-email' });

      expect(res.status).toBe(400);
      expect(authService.startEmailOtp).not.toHaveBeenCalled();
    });
  });

  describe('existing routes keep the shared filter shape (OTP-R-10)', () => {
    it('login/custom is untouched: the global HttpExceptionFilter still drops object bodies', async () => {
      // Guard against accidental controller-wide scoping of the OTP filter.
      const filters = Reflect.getMetadata(
        EXCEPTION_FILTERS_METADATA,
        AuthController.prototype.loginWithCustomPassword,
      );
      const classFilters = Reflect.getMetadata(
        EXCEPTION_FILTERS_METADATA,
        AuthController,
      );
      expect(filters).toBeUndefined();
      expect(classFilters).toBeUndefined();
    });
  });

  describe('log hygiene through the global LoggingInterceptor (OTP-R-11)', () => {
    // Obviously fake fixtures sized like the real artefacts (~1.5k session, ~1k JWT).
    const FAKE_SESSION = 'FAKE-OTP-SESSION-' + 'x'.repeat(1600);
    const FAKE_ACCESS = 'FAKE-ACCESS-TOKEN-' + 'a'.repeat(1000);
    const FAKE_ID = 'FAKE-ID-TOKEN-' + 'i'.repeat(1000);
    const FAKE_REFRESH = 'FAKE-REFRESH-TOKEN-' + 'r'.repeat(300);

    let logSpy: jest.SpyInstance;
    let errorSpy: jest.SpyInstance;
    let warnSpy: jest.SpyInstance;

    const allLoggedText = (): string[] =>
      [logSpy, errorSpy, warnSpy]
        .flatMap((spy) => spy.mock.calls)
        .flatMap((args) => args)
        .map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg)));

    beforeEach(() => {
      logSpy = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => undefined);
      errorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      warnSpy = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
    });

    afterEach(() => {
      logSpy.mockRestore();
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it('start: the session never reaches any logger call, the client body is unchanged', async () => {
      const started = {
        challengeName: 'CUSTOM_CHALLENGE' as const,
        session: FAKE_SESSION,
        codeDeliveryDestination: 'u***@icrisat.org',
      };
      const snapshot = JSON.stringify(started);
      authService.startEmailOtp.mockResolvedValue(started);

      const res = await request(app.getHttpServer())
        .post('/auth/login/otp/start')
        .send({ username: 'user@icrisat.org' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual(started);
      expect(res.body.session).toBe(FAKE_SESSION);
      // The interceptor must not mutate the object the handler returned.
      expect(JSON.stringify(started)).toBe(snapshot);

      const logged = allLoggedText();
      const responseLine = logged.find((line) => line.includes('[Response'));
      expect(responseLine).toBeDefined();
      expect(responseLine).toContain('POST /auth/login/otp/start 201');
      expect(responseLine).toContain('"session":"[REDACTED]"');
      expect(logged).not.toEqual(
        expect.arrayContaining([expect.stringContaining(FAKE_SESSION)]),
      );
      expect(logged).not.toEqual(
        expect.arrayContaining([expect.stringContaining('FAKE-OTP-SESSION')]),
      );
    });

    it('verify: no token string reaches any logger call, the client body is unchanged', async () => {
      const tokens = {
        tokens: {
          accessToken: FAKE_ACCESS,
          idToken: FAKE_ID,
          refreshToken: FAKE_REFRESH,
          expiresIn: 3600,
          tokenType: 'Bearer',
        },
      };
      const snapshot = JSON.stringify(tokens);
      authService.verifyEmailOtp.mockResolvedValue(tokens);

      const res = await request(app.getHttpServer())
        .post('/auth/login/otp/verify')
        .send({
          username: 'user@icrisat.org',
          code: '12345678',
          session: 'AYABe',
        });

      expect(res.status).toBe(201);
      expect(res.body).toEqual(tokens);
      expect(res.body.tokens.accessToken).toBe(FAKE_ACCESS);
      expect(JSON.stringify(tokens)).toBe(snapshot);

      const logged = allLoggedText();
      const responseLine = logged.find((line) => line.includes('[Response'));
      expect(responseLine).toBeDefined();
      expect(responseLine).toContain('POST /auth/login/otp/verify 201');
      expect(responseLine).toContain('"tokens":"[REDACTED]"');
      for (const marker of [
        FAKE_ACCESS,
        FAKE_ID,
        FAKE_REFRESH,
        'FAKE-ACCESS-TOKEN',
        'FAKE-ID-TOKEN',
        'FAKE-REFRESH-TOKEN',
      ]) {
        expect(logged).not.toEqual(
          expect.arrayContaining([expect.stringContaining(marker)]),
        );
      }
    });
  });
});
