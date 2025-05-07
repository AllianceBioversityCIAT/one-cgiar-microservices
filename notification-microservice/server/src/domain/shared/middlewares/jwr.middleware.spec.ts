import { ClarisaService } from '../../tools/clarisa/clarisa.service';
import { UnauthorizedException, BadGatewayException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtMiddleware } from './jwr.middleware';

describe('JwtMiddleware', () => {
  let middleware: JwtMiddleware;
  let clarisaService: ClarisaService;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    clarisaService = { authorization: jest.fn() } as any;
    middleware = new JwtMiddleware(clarisaService as ClarisaService);
    mockRequest = {};
    mockResponse = {};
    nextFunction = jest.fn();
  });

  it('should throw UnauthorizedException if auth header is invalid', async () => {
    mockRequest = {
      headers: {
        auth: 'invalid json',
      },
    };

    await expect(
      middleware.use(mockRequest as any, mockResponse as any, nextFunction),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw BadGatewayException if auth header is missing', async () => {
    mockRequest = {
      headers: {},
    };

    await expect(
      middleware.use(mockRequest as any, mockResponse as any, nextFunction),
    ).rejects.toThrow(BadGatewayException);
  });

  it('should throw UnauthorizedException if credentials are invalid', async () => {
    mockRequest = {
      headers: {
        auth: JSON.stringify({ username: 'test', password: 'test' }),
      },
    };
    (clarisaService.authorization as jest.Mock).mockResolvedValue({
      valid: false,
    });

    await expect(
      middleware.use(mockRequest as any, mockResponse as any, nextFunction),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should call next function if credentials are valid', async () => {
    const authData = {
      valid: true,
      data: { receiver_mis: 'test_mis' },
    };
    mockRequest = {
      headers: {
        auth: JSON.stringify({ username: 'test', password: 'test' }),
      },
    };
    (clarisaService.authorization as jest.Mock).mockResolvedValue(authData);

    await middleware.use(mockRequest as any, mockResponse as any, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
  });
});
