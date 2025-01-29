import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { of } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';
import { ENV } from '../../utils/env.utils';
import { ServerResponseDto } from '../global-dto/server-response.dto';

describe('ResponseInterceptor', () => {
  let interceptor: ResponseInterceptor;
  let env: ENV;
  let mockContext: ExecutionContext;
  let mockNext: any;
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(() => {
    env = {
      SEE_ALL_LOGS: true,
      IS_PRODUCTION: false,
    } as unknown as ENV;

    interceptor = new ResponseInterceptor(env);

    mockRequest = {
      url: '/test-endpoint',
      method: 'GET',
      socket: {
        remoteAddress: '127.0.0.1',
      },
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
    };

    mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
    } as unknown as ExecutionContext;

    mockNext = {
      handle: jest.fn().mockReturnValue(of(null)),
    };
  });

  it('should format a successful ServiceResponseDto', async () => {
    await interceptor.intercept(mockContext, mockNext).toPromise();

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(mockNext.handle).toHaveBeenCalled();

    const formattedResponse = (await mockNext
      .handle()
      .toPromise()) as ServerResponseDto<{ message: string }>;
    expect(formattedResponse).toEqual(null);
  });

  it('should log based on response status', async () => {
    const loggerSpy = jest.spyOn(interceptor['_logger'], 'verbose');

    await interceptor.intercept(mockContext, mockNext).toPromise();

    expect(loggerSpy).toHaveBeenCalledWith(
      '[GET]: /test-endpoint status: 200 - By 127.0.0.1',
    );
  });
});
