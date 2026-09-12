import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { OtpHttpExceptionFilter } from './otp-http-exception.filter';

/**
 * OTP-T-3 rework — `OtpHttpExceptionFilter` (OTP-R-7, design.md §4.2 "Errors
 * (stable codes)"). The shared `HttpExceptionFilter` rebuilds the body from
 * `exception.message` only and drops `code`; this route-local filter must keep
 * the stable code on the wire while producing the shared shape otherwise.
 */
describe('OtpHttpExceptionFilter', () => {
  let filter: OtpHttpExceptionFilter;
  const mockLoggerError = jest.fn();
  const fixedDate = new Date('2026-09-11T10:00:00.000Z');

  const secretSession = 'AYABe-secret-session-value';
  const secretCode = '12345678';

  const buildHost = (method = 'POST', url = '/auth/login/otp/verify') => {
    const mockRequest = {
      url,
      method,
      body: {
        username: 'user@icrisat.org',
        code: secretCode,
        session: secretSession,
      },
    } as unknown as Request;
    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const host = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    };
    return { host, mockResponse };
  };

  beforeEach(() => {
    filter = new OtpHttpExceptionFilter();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(mockLoggerError);
    jest.spyOn(global, 'Date').mockImplementation(() => fixedDate as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mockLoggerError.mockReset();
  });

  it('keeps the stable `code` when the exception response is an object', () => {
    const { host, mockResponse } = buildHost();
    const exception = new HttpException(
      { code: 'CODE_MISMATCH', message: 'The code entered is incorrect.' },
      HttpStatus.UNAUTHORIZED,
    );

    filter.catch(exception, host as any);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.UNAUTHORIZED,
      code: 'CODE_MISMATCH',
      message: 'The code entered is incorrect.',
      path: '/auth/login/otp/verify',
      timestamp: fixedDate.toISOString(),
    });
  });

  it('keeps a 502 UPSTREAM_ERROR object body intact', () => {
    const { host, mockResponse } = buildHost('POST', '/auth/login/otp/start');
    const exception = new HttpException(
      { code: 'UPSTREAM_ERROR', message: 'Cognito unavailable.' },
      HttpStatus.BAD_GATEWAY,
    );

    filter.catch(exception, host as any);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_GATEWAY);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_GATEWAY,
        code: 'UPSTREAM_ERROR',
        message: 'Cognito unavailable.',
        path: '/auth/login/otp/start',
      }),
    );
  });

  it('produces the shared HttpExceptionFilter shape when the response is a string', () => {
    const { host, mockResponse } = buildHost();
    const exception = new HttpException(
      'Authentication failed',
      HttpStatus.UNAUTHORIZED,
    );

    filter.catch(exception, host as any);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.UNAUTHORIZED,
      message: 'Authentication failed',
      path: '/auth/login/otp/verify',
      timestamp: fixedDate.toISOString(),
    });
  });

  it('falls back to "Internal server error" when a string response is empty', () => {
    const { host, mockResponse } = buildHost();
    const exception = new HttpException('', HttpStatus.INTERNAL_SERVER_ERROR);

    filter.catch(exception, host as any);

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
      }),
    );
  });

  it('logs method, path, status and message but never the request body (session/code)', () => {
    const { host } = buildHost();
    const exception = new HttpException(
      { code: 'CODE_EXPIRED', message: 'The code has expired.' },
      HttpStatus.UNAUTHORIZED,
    );

    filter.catch(exception, host as any);

    expect(mockLoggerError).toHaveBeenCalledWith(
      'POST /auth/login/otp/verify 401 - The code has expired.',
      exception.stack,
    );
    const logged = JSON.stringify(mockLoggerError.mock.calls);
    expect(logged).not.toContain(secretSession);
    expect(logged).not.toContain(secretCode);
    expect(logged).not.toContain('user@icrisat.org');
  });
});
