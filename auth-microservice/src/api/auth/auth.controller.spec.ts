import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ProviderAuthDto } from './dto/provider-auth.dto';
import { ValidateCodeDto } from './dto/validate-code.dto';
import { HttpException, HttpStatus } from '@nestjs/common';
import { MisMetadataDto } from '../../tools/clarisa/dto/mis-medatada.dto';
import { RequestWithCustomAttrs } from '../../middleware/jwt-clarisa.middleware';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    authenticateWithProvider: jest.fn(),
    validateAuthorizationCode: jest.fn(),
    getUserInfo: jest.fn(),
  };

  const createMockRequest = (hasMisAuth: boolean = true) => {
    const misAuth = hasMisAuth
      ? {
          id: 1,
          mis_id: 123,
          auth_url: 'https://example.com/callback',
          cognito_client_id: 'test-client-id',
          cognito_client_secret: 'test-client-secret',
        }
      : undefined;

    return {
      application: {
        id: 456,
        name: 'Auth Microservice',
        acronym: 'AUTH',
        environment: 'TEST',
      },
      senderId: 123,
      senderMisMetadata: {
        id: 123,
        name: 'Test MIS',
        acronym: 'TST',
        main_contact_point_id: 789,
        environment_id: 1,
        mis_auth: misAuth,
      } as MisMetadataDto,
    } as RequestWithCustomAttrs;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('loginWithProvider', () => {
    it('should call authenticateWithProvider with correct parameters', async () => {
      const providerAuthDto: ProviderAuthDto = {
        provider: 'CGIAR-AzureAD',
      };
      const mockRequest = createMockRequest();
      const expectedResult = { authUrl: 'https://example.com/auth' };

      mockAuthService.authenticateWithProvider.mockResolvedValue(
        expectedResult,
      );

      const result = await controller.loginWithProvider(
        providerAuthDto,
        mockRequest,
      );

      expect(authService.authenticateWithProvider).toHaveBeenCalledWith(
        providerAuthDto,
        mockRequest,
      );
      expect(result).toEqual(expectedResult);
    });

    it('should handle errors from authenticateWithProvider', async () => {
      const providerAuthDto: ProviderAuthDto = {
        provider: 'CGIAR-AzureAD',
      };
      const mockRequest = createMockRequest();
      const expectedError = new HttpException(
        'MIS authentication information not found',
        HttpStatus.BAD_REQUEST,
      );

      mockAuthService.authenticateWithProvider.mockRejectedValue(expectedError);

      await expect(
        controller.loginWithProvider(providerAuthDto, mockRequest),
      ).rejects.toThrow(expectedError);
    });
  });

  describe('validateAuthorizationCode', () => {
    it('should call validateAuthorizationCode with correct parameters', async () => {
      const validateCodeDto: ValidateCodeDto = {
        code: 'test-auth-code',
      };
      const mockRequest = createMockRequest();
      const expectedResult = {
        accessToken: 'test-access-token',
        idToken: 'test-id-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 3600,
        tokenType: 'Bearer',
        userInfo: {
          sub: 'test-sub',
          email: 'test@example.com',
          name: 'Test User',
        },
      };

      mockAuthService.validateAuthorizationCode.mockResolvedValue(
        expectedResult,
      );

      const result = await controller.validateAuthorizationCode(
        validateCodeDto,
        mockRequest,
      );

      expect(authService.validateAuthorizationCode).toHaveBeenCalledWith(
        validateCodeDto,
        mockRequest,
      );
      expect(result).toEqual(expectedResult);
    });

    it('should handle errors from validateAuthorizationCode', async () => {
      const validateCodeDto: ValidateCodeDto = {
        code: 'invalid-code',
      };
      const mockRequest = createMockRequest();
      const expectedError = new HttpException(
        'Authentication failed: Invalid authorization code',
        HttpStatus.UNAUTHORIZED,
      );

      mockAuthService.validateAuthorizationCode.mockRejectedValue(
        expectedError,
      );

      await expect(
        controller.validateAuthorizationCode(validateCodeDto, mockRequest),
      ).rejects.toThrow(expectedError);
    });
  });

  describe('getUserInfo', () => {
    it('should call getUserInfo with correct access token', async () => {
      const body = { accessToken: 'test-access-token' };
      const expectedResult = {
        sub: 'test-sub',
        email: 'test@example.com',
        name: 'Test User',
      };

      mockAuthService.getUserInfo.mockResolvedValue(expectedResult);

      const result = await controller.getUserInfo(body);

      expect(authService.getUserInfo).toHaveBeenCalledWith(body.accessToken);
      expect(result).toEqual(expectedResult);
    });

    it('should handle errors from getUserInfo', async () => {
      const body = { accessToken: 'invalid-token' };
      const expectedError = new HttpException(
        'Error retrieving user information',
        HttpStatus.UNAUTHORIZED,
      );

      mockAuthService.getUserInfo.mockRejectedValue(expectedError);

      await expect(controller.getUserInfo(body)).rejects.toThrow(expectedError);
    });
  });
});
