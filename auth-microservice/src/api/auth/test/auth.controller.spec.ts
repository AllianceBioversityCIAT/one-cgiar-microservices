import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { ProviderAuthDto } from '../dto/provider-auth.dto';
import { ValidateCodeDto } from '../dto/validate-code.dto';
import { CustomAuthDto } from '../dto/custom-auth.dto';
import { HttpException } from '@nestjs/common';
import { RequestWithCustomAttrs } from '../../../middleware/jwt-clarisa.middleware';

const createMockRequest = () => {
  const req = {
    app: {},
    baseUrl: '',
    body: {},
    cookies: {},
    fresh: true,
    hostname: 'localhost',
    ip: '127.0.0.1',
    ips: [],
    method: 'GET',
    originalUrl: '',
    params: {},
    path: '',
    protocol: 'http',
    query: {},
    route: {},
    secure: false,
    signedCookies: {},
    stale: false,
    subdomains: [],
    xhr: false,

    accepts: jest.fn().mockReturnValue(true),
    acceptsCharsets: jest.fn().mockReturnValue(true),
    acceptsEncodings: jest.fn().mockReturnValue(true),
    acceptsLanguages: jest.fn().mockReturnValue(true),
    get: jest.fn().mockReturnValue(''),
    header: jest.fn().mockReturnValue(''),
    is: jest.fn().mockReturnValue(false),

    senderMisMetadata: {
      mis_auth: {
        cognito_client_id: 'mock-client-id',
        cognito_client_secret: 'mock-client-secret',
        auth_url: 'https://mock-redirect.com/callback',
      },
    },
  } as unknown as RequestWithCustomAttrs;

  return req;
};

const mockRequest = createMockRequest();

const mockAuthService = {
  authenticateWithProvider: jest.fn(),
  validateAuthorizationCode: jest.fn(),
  getUserInfo: jest.fn(),
  authenticateWithCustomPassword: jest.fn(),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
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

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('loginWithProvider', () => {
    it('should call authenticateWithProvider with correct parameters', async () => {
      const providerAuthDto: ProviderAuthDto = {
        provider: 'CGIAR-AzureAD',
      };
      const expectedResult = { authUrl: 'https://example.com/auth' };
      mockAuthService.authenticateWithProvider.mockResolvedValue(
        expectedResult,
      );

      const result = await controller.loginWithProvider(
        providerAuthDto,
        mockRequest,
      );

      expect(mockAuthService.authenticateWithProvider).toHaveBeenCalledWith(
        providerAuthDto,
        mockRequest,
      );
      expect(result).toEqual(expectedResult);
    });

    it('should propagate errors from service', async () => {
      const providerAuthDto: ProviderAuthDto = {
        provider: 'CGIAR-AzureAD',
      };
      const errorMessage = 'Authentication failed';
      mockAuthService.authenticateWithProvider.mockRejectedValue(
        new HttpException(errorMessage, 400),
      );

      await expect(
        controller.loginWithProvider(providerAuthDto, mockRequest),
      ).rejects.toThrow(HttpException);
      expect(mockAuthService.authenticateWithProvider).toHaveBeenCalledWith(
        providerAuthDto,
        mockRequest,
      );
    });
  });

  describe('validateAuthorizationCode', () => {
    it('should call validateAuthorizationCode with correct parameters', async () => {
      const validateCodeDto: ValidateCodeDto = {
        code: 'mock-auth-code',
      };
      const expectedResult = {
        accessToken: 'mock-access-token',
        idToken: 'mock-id-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 3600,
        tokenType: 'Bearer',
        userInfo: {
          sub: 'user123',
          email: 'user@example.com',
        },
      };
      mockAuthService.validateAuthorizationCode.mockResolvedValue(
        expectedResult,
      );

      const result = await controller.validateAuthorizationCode(
        validateCodeDto,
        mockRequest,
      );

      expect(mockAuthService.validateAuthorizationCode).toHaveBeenCalledWith(
        validateCodeDto,
        mockRequest,
      );
      expect(result).toEqual(expectedResult);
    });

    it('should propagate errors from service', async () => {
      const validateCodeDto: ValidateCodeDto = {
        code: 'invalid-code',
      };
      const errorMessage = 'Invalid authorization code';
      mockAuthService.validateAuthorizationCode.mockRejectedValue(
        new HttpException(errorMessage, 400),
      );

      await expect(
        controller.validateAuthorizationCode(validateCodeDto, mockRequest),
      ).rejects.toThrow(HttpException);
      expect(mockAuthService.validateAuthorizationCode).toHaveBeenCalledWith(
        validateCodeDto,
        mockRequest,
      );
    });
  });

  describe('getUserInfo', () => {
    it('should call getUserInfo with access token', async () => {
      const accessToken = 'mock-access-token';
      const expectedUserInfo = {
        sub: 'user123',
        email: 'user@example.com',
        name: 'Test User',
      };
      mockAuthService.getUserInfo.mockResolvedValue(expectedUserInfo);

      const result = await controller.getUserInfo({ accessToken });

      expect(mockAuthService.getUserInfo).toHaveBeenCalledWith(accessToken);
      expect(result).toEqual(expectedUserInfo);
    });

    it('should propagate errors from service', async () => {
      const accessToken = 'invalid-token';
      const errorMessage = 'Invalid token';
      mockAuthService.getUserInfo.mockRejectedValue(
        new HttpException(errorMessage, 401),
      );

      await expect(controller.getUserInfo({ accessToken })).rejects.toThrow(
        HttpException,
      );
      expect(mockAuthService.getUserInfo).toHaveBeenCalledWith(accessToken);
    });
  });

  describe('loginWithCustomPassword', () => {
    it('should call authenticateWithCustomPassword with correct credentials', async () => {
      const customAuthDto: CustomAuthDto = {
        username: 'user@cgiar.org',
        password: 'password123',
      };
      const expectedResult = {
        tokens: {
          accessToken: 'mock-access-token',
          idToken: 'mock-id-token',
          refreshToken: 'mock-refresh-token',
          expiresIn: 3600,
          tokenType: 'Bearer',
        },
        userInfo: {
          sub: 'user123',
          email: 'user@cgiar.org',
        },
      };
      mockAuthService.authenticateWithCustomPassword.mockResolvedValue(
        expectedResult,
      );

      const result = await controller.loginWithCustomPassword(customAuthDto);

      expect(
        mockAuthService.authenticateWithCustomPassword,
      ).toHaveBeenCalledWith(customAuthDto);
      expect(result).toEqual(expectedResult);
    });

    it('should propagate errors from service during authentication', async () => {
      const customAuthDto: CustomAuthDto = {
        username: 'user@cgiar.org',
        password: 'wrong-password',
      };
      const errorMessage = 'Authentication failed';
      mockAuthService.authenticateWithCustomPassword.mockRejectedValue(
        new HttpException(errorMessage, 401),
      );

      await expect(
        controller.loginWithCustomPassword(customAuthDto),
      ).rejects.toThrow(HttpException);
      expect(
        mockAuthService.authenticateWithCustomPassword,
      ).toHaveBeenCalledWith(customAuthDto);
    });
  });
});
