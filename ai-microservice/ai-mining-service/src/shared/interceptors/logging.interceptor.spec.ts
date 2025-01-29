import { LoggingInterceptor } from './logging.interceptor';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { Logger } from '@nestjs/common';
import { ENV } from '../../utils/env.utils';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let env: ENV;
  let logger: Logger;

  beforeEach(() => {
    env = {
      get SEE_ALL_LOGS() {
        return true;
      },
      get IS_PRODUCTION() {
        return false;
      },
    } as unknown as ENV;

    logger = {
      log: jest.fn(),
      error: jest.fn(),
    } as unknown as Logger;

    interceptor = new LoggingInterceptor(env);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should log the request when SEE_ALL_LOGS is true', async () => {
    const mockContext = createMockExecutionContext();
    const mockNext: CallHandler = {
      handle: jest.fn().mockReturnValue(of(null)),
    };

    const logSpy = jest.spyOn(interceptor['_logger'], 'log');

    await interceptor.intercept(mockContext, mockNext).toPromise();

    expect(logSpy).toHaveBeenCalledWith(`[GET]: /test-url - By 127.0.0.1`);
  });

  it('should not log the request when SEE_ALL_LOGS is false', async () => {
    jest.spyOn(env, 'SEE_ALL_LOGS', 'get').mockReturnValue(false);

    const mockContext = createMockExecutionContext();
    const mockNext: CallHandler = {
      handle: jest.fn().mockReturnValue(of(null)),
    };

    await interceptor.intercept(mockContext, mockNext).toPromise();

    expect(logger.log).not.toHaveBeenCalled();
  });

  function createMockExecutionContext(): ExecutionContext {
    const request = {
      method: 'GET',
      url: '/test-url',
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as Request;

    const context = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
      }),
    } as unknown as ExecutionContext;

    return context;
  }
});
