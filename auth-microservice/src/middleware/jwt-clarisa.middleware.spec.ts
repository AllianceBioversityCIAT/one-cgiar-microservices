import { Test, TestingModule } from '@nestjs/testing';
import {
  BadGatewayException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import {
  JwtClarisaMiddleware,
  RequestWithCustomAttrs,
} from './jwt-clarisa.middleware';
import { ClarisaService } from '../tools/clarisa/clarisa.service';
import { Response, NextFunction } from 'express';
import { MisMetadataDto } from '../tools/clarisa/dto/mis-medatada.dto';
import { ResMisConfigDto } from '../tools/clarisa/dto/clarisa-create-conection.dto';

describe('JwtClarisaMiddleware', () => {
  let middleware: JwtClarisaMiddleware;
  let clarisaService: ClarisaService;

  const mockClarisaService = {
    authorization: jest.fn(),
  };

  const mockLogger = {
    debug: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    jest.spyOn(Logger.prototype, 'debug').mockImplementation(mockLogger.debug);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(mockLogger.log);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(mockLogger.error);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtClarisaMiddleware,
        { provide: ClarisaService, useValue: mockClarisaService },
      ],
    }).compile();

    middleware = module.get<JwtClarisaMiddleware>(JwtClarisaMiddleware);
    clarisaService = module.get<ClarisaService>(ClarisaService);
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  describe('use', () => {
    let mockRequest: Partial<RequestWithCustomAttrs>;
    let mockResponse: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockRequest = {
        headers: {},
      };
      mockResponse = {};
      mockNext = jest.fn();
    });

    it('should throw error when auth header is missing', async () => {
      await expect(
        middleware.use(
          mockRequest as RequestWithCustomAttrs,
          mockResponse as Response,
          mockNext,
        ),
      ).rejects.toThrow(BadGatewayException);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Auth header is missing or not in the correct format',
      );
    });

    it('should throw error when auth header is not valid JSON', async () => {
      mockRequest.headers = {
        auth: 'invalid-json-format',
      };

      await expect(
        middleware.use(
          mockRequest as RequestWithCustomAttrs,
          mockResponse as Response,
          mockNext,
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid auth header format',
        expect.anything(),
      );
    });

    it('should throw error when credentials are invalid', async () => {
      mockRequest.headers = {
        auth: JSON.stringify({
          username: 'invalid-client-id',
          password: 'invalid-client-secret',
        }),
      };

      mockClarisaService.authorization.mockResolvedValue({
        valid: false,
        data: null,
      });

      await expect(
        middleware.use(
          mockRequest as RequestWithCustomAttrs,
          mockResponse as Response,
          mockNext,
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(clarisaService.authorization).toHaveBeenCalledWith(
        'invalid-client-id',
        'invalid-client-secret',
      );

      expect(mockLogger.error).toHaveBeenCalledWith('Invalid credentials');
    });

    it('should throw error when MIS has no auth configuration', async () => {
      mockRequest.headers = {
        auth: JSON.stringify({
          username: 'valid-client-id',
          password: 'valid-client-secret',
        }),
      };

      const senderMis: ResMisConfigDto = {
        id: 123,
        name: 'Test MIS',
        acronym: 'TST',
        environment: 'DEV',
      };

      const receiverMis: ResMisConfigDto = {
        id: 456,
        name: 'Auth Microservice',
        acronym: 'AUTH',
        environment: 'TEST',
      };

      const senderMisMetadata: MisMetadataDto = {
        id: 123,
        name: 'Test MIS',
        acronym: 'TST',
        main_contact_point_id: 789,
        environment_id: 1,
      };

      mockClarisaService.authorization.mockResolvedValue({
        valid: true,
        data: {
          client_id: 'valid-client-id',
          sender_mis: senderMis,
          receiver_mis: receiverMis,
          sender_mis_metadata: senderMisMetadata,
        },
      });

      await expect(
        middleware.use(
          mockRequest as RequestWithCustomAttrs,
          mockResponse as Response,
          mockNext,
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'MIS ID 123 does not have authentication configuration',
      );
    });

    it('should set request properties and call next when validation succeeds', async () => {
      mockRequest.headers = {
        auth: JSON.stringify({
          username: 'valid-client-id',
          password: 'valid-client-secret',
        }),
      };

      const senderMis: ResMisConfigDto = {
        id: 123,
        name: 'Test MIS',
        acronym: 'TST',
        environment: 'DEV',
      };

      const receiverMis: ResMisConfigDto = {
        id: 456,
        name: 'Auth Microservice',
        acronym: 'AUTH',
        environment: 'TEST',
      };

      const senderMisMetadata: MisMetadataDto = {
        id: 123,
        name: 'Test MIS',
        acronym: 'TST',
        main_contact_point_id: 789,
        environment_id: 1,
        mis_auth: {
          id: 1,
          mis_id: 123,
          auth_url: 'https://example.com/callback',
          cognito_client_id: 'test-cognito-id',
          cognito_client_secret: 'test-cognito-secret',
        },
      };

      mockClarisaService.authorization.mockResolvedValue({
        valid: true,
        data: {
          client_id: 'valid-client-id',
          sender_mis: senderMis,
          receiver_mis: receiverMis,
          sender_mis_metadata: senderMisMetadata,
        },
      });

      await middleware.use(
        mockRequest as RequestWithCustomAttrs,
        mockResponse as Response,
        mockNext,
      );

      expect(mockRequest.application).toEqual(receiverMis);
      expect(mockRequest.senderId).toBe(senderMis.id);
      expect(mockRequest.senderMisMetadata).toEqual(senderMisMetadata);

      expect(mockNext).toHaveBeenCalled();

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining(
          `Client ${senderMis.name} (ID: ${senderMis.id})`,
        ),
      );
    });

    it('should handle unexpected errors during authorization', async () => {
      mockRequest.headers = {
        auth: JSON.stringify({
          username: 'valid-client-id',
          password: 'valid-client-secret',
        }),
      };

      const unexpectedError = new Error('Unexpected service error');
      mockClarisaService.authorization.mockRejectedValue(unexpectedError);

      await expect(
        middleware.use(
          mockRequest as RequestWithCustomAttrs,
          mockResponse as Response,
          mockNext,
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error validating client credentials',
        unexpectedError,
      );
    });

    it('should propagate specific exceptions from the service', async () => {
      mockRequest.headers = {
        auth: JSON.stringify({
          username: 'valid-client-id',
          password: 'valid-client-secret',
        }),
      };

      const specificException = new UnauthorizedException(
        'Specific authorization error',
      );
      mockClarisaService.authorization.mockRejectedValue(specificException);

      await expect(
        middleware.use(
          mockRequest as RequestWithCustomAttrs,
          mockResponse as Response,
          mockNext,
        ),
      ).rejects.toThrow(specificException);

      expect(mockLogger.error).not.toHaveBeenCalledWith(
        'Error validating client credentials',
        expect.anything(),
      );
    });
  });
});
