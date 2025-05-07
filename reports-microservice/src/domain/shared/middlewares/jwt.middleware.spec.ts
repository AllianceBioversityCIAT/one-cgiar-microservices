import { Request, Response, NextFunction } from 'express';
import { BadGatewayException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClarisaService } from '../../tools/clarisa/clarisa.service';
import { JwtMiddleware } from './jwt.middleware';
import { ResClarisaValidateConectioDto } from '../../tools/clarisa/dto/clarisa-create-conection.dto';

describe('JwtMiddleware', () => {
  let jwtMiddleware: JwtMiddleware;
  let configService: ConfigService;
  let clarisaService: ClarisaService;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    configService = {
      get: jest.fn().mockReturnValue('mockOwnerUser'),
    } as unknown as ConfigService;

    clarisaService = {
      authorization: jest.fn(),
    } as unknown as ClarisaService;

    jwtMiddleware = new JwtMiddleware(clarisaService, configService);

    mockRequest = {
      headers: {},
    };
    mockResponse = {};
    mockNext = jest.fn();
  });

  it('should throw BadGatewayException if auth header is missing', async () => {
    mockRequest.headers = {};

    await expect(
      jwtMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      ),
    ).rejects.toThrow(BadGatewayException);

    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException if auth header is not a valid JSON string', async () => {
    mockRequest.headers['auth'] = 'invalid_json_string';

    await expect(
      jwtMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      ),
    ).rejects.toThrow(UnauthorizedException);

    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should throw InvalidCredentialsException if clarisaService.authorization returns no data', async () => {
    mockRequest.headers['auth'] = JSON.stringify({
      username: 'user',
      password: 'pass',
    });
    (clarisaService.authorization as jest.Mock).mockResolvedValueOnce({
      data: null,
    });

    await expect(
      jwtMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      ),
    ).rejects.toThrow(UnauthorizedException);

    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedAccessException if the receiver_mis.acronym does not match ownerUser', async () => {
    mockRequest.headers['auth'] = JSON.stringify({
      username: 'user',
      password: 'pass',
    });

    const mockAuthData: ResClarisaValidateConectioDto = {
      client_id: 'mockClientId',
      sender_mis: {
        acronym: 'senderAcronym',
        environment: 'development',
        code: 123,
        name: 'Sender Name',
      },
      receiver_mis: {
        acronym: 'wrongAcronym',
        environment: 'development',
        code: 456,
        name: 'Receiver Name',
      },
    };

    (clarisaService.authorization as jest.Mock).mockResolvedValueOnce(
      mockAuthData,
    );

    await expect(
      jwtMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      ),
    ).rejects.toThrow(UnauthorizedException);

    expect(mockNext).not.toHaveBeenCalled();
  });
});
