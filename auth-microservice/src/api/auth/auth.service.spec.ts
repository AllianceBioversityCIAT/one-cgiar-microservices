import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { AuthService } from './auth.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { ProviderAuthDto } from './dto/provider-auth.dto';
import { ValidateCodeDto } from './dto/validate-code.dto';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { MisMetadataDto } from '../../tools/clarisa/dto/mis-medatada.dto';
import { RequestWithCustomAttrs } from '../../middleware/jwt-clarisa.middleware';

describe('AuthService', () => {
  let service: AuthService;
  let httpService: HttpService;
  let configService: ConfigService;

  const mockHttpService = {
    post: jest.fn(),
    get: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
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

    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    httpService = module.get<HttpService>(HttpService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('authenticateWithProvider', () => {
    it('should return an authentication URL when MIS has valid auth config', async () => {
      const providerAuthDto: ProviderAuthDto = {
        provider: 'CGIAR-AzureAD',
      };
      const mockRequest = createMockRequest(true);
      const expectedCognitoUrl = 'https://cognito-domain.com';

      mockConfigService.get.mockReturnValue(expectedCognitoUrl);

      const result = await service.authenticateWithProvider(
        providerAuthDto,
        mockRequest,
      );

      expect(result).toHaveProperty('authUrl');
      expect(result.authUrl).toContain(
        'https://cognito-domain.com/oauth2/authorize',
      );
      expect(result.authUrl).toContain('client_id=test-client-id');
      expect(result.authUrl).toContain(
        'redirect_uri=https://example.com/callback',
      );
      expect(result.authUrl).toContain('identity_provider=CGIAR-AzureAD');

      expect(configService.get).toHaveBeenCalledWith('COGNITO_URL');
    });

    it('should throw an error when MIS metadata is missing', async () => {
      const providerAuthDto: ProviderAuthDto = {
        provider: 'CGIAR-AzureAD',
      };

      const mockRequestWithoutMetadata = {} as RequestWithCustomAttrs;

      await expect(
        service.authenticateWithProvider(
          providerAuthDto,
          mockRequestWithoutMetadata,
        ),
      ).rejects.toThrow(
        new HttpException(
          'MIS authentication information not found',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should throw an error when MIS auth information is missing', async () => {
      const providerAuthDto: ProviderAuthDto = {
        provider: 'CGIAR-AzureAD',
      };

      const mockRequestWithoutAuth = createMockRequest(false);

      await expect(
        service.authenticateWithProvider(
          providerAuthDto,
          mockRequestWithoutAuth,
        ),
      ).rejects.toThrow(
        new HttpException(
          'MIS authentication information not found',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });
  });

  describe('validateAuthorizationCode', () => {
    it('should return tokens and user info when code is valid', async () => {
      const validateCodeDto: ValidateCodeDto = {
        code: 'test-auth-code',
      };
      const mockRequest = createMockRequest(true);
      const expectedCognitoUrl = 'https://cognito-domain.com';

      mockConfigService.get.mockReturnValue(expectedCognitoUrl);

      const tokenResponse: AxiosResponse = {
        data: {
          access_token: 'test-access-token',
          id_token: 'test-id-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      const userInfoResponse: AxiosResponse = {
        data: {
          sub: 'test-sub',
          email: 'test@example.com',
          name: 'Test User',
          given_name: 'Test',
          family_name: 'User',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.post.mockReturnValue(of(tokenResponse));
      mockHttpService.get.mockReturnValue(of(userInfoResponse));

      const result = await service.validateAuthorizationCode(
        validateCodeDto,
        mockRequest,
      );

      expect(result).toHaveProperty('accessToken', 'test-access-token');
      expect(result).toHaveProperty('idToken', 'test-id-token');
      expect(result).toHaveProperty('refreshToken', 'test-refresh-token');
      expect(result).toHaveProperty('expiresIn', 3600);
      expect(result).toHaveProperty('tokenType', 'Bearer');
      expect(result).toHaveProperty('userInfo');
      expect(result.userInfo).toEqual(userInfoResponse.data);

      expect(httpService.post).toHaveBeenCalledWith(
        'https://cognito-domain.com/oauth2/token',
        expect.any(String),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );

      expect(httpService.get).toHaveBeenCalledWith(
        'https://cognito-domain.com/oauth2/userInfo',
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-access-token' },
        }),
      );
    });

    it('should throw an error when MIS metadata is missing', async () => {
      const validateCodeDto: ValidateCodeDto = {
        code: 'test-auth-code',
      };

      const mockRequestWithoutMetadata = {} as RequestWithCustomAttrs;

      await expect(
        service.validateAuthorizationCode(
          validateCodeDto,
          mockRequestWithoutMetadata,
        ),
      ).rejects.toThrow(
        new HttpException(
          "Cannot read properties of undefined (reading 'error_description')",
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should throw an error when token endpoint returns an error', async () => {
      const validateCodeDto: ValidateCodeDto = {
        code: 'invalid-code',
      };

      const mockRequest = createMockRequest(true);
      mockConfigService.get.mockReturnValue('https://cognito-domain.com');

      const errorResponse = {
        response: {
          data: {
            error: 'invalid_grant',
            error_description: 'Invalid authorization code',
          },
          status: 400,
        },
      };

      mockHttpService.post.mockReturnValue(throwError(() => errorResponse));

      await expect(
        service.validateAuthorizationCode(validateCodeDto, mockRequest),
      ).rejects.toThrow(
        new HttpException(
          'Authentication failed: Invalid authorization code',
          HttpStatus.UNAUTHORIZED,
        ),
      );
    });

    it('should throw an error when userInfo endpoint returns an error', async () => {
      const validateCodeDto: ValidateCodeDto = {
        code: 'test-auth-code',
      };

      const mockRequest = createMockRequest(true);
      mockConfigService.get.mockReturnValue('https://cognito-domain.com');

      const tokenResponse: AxiosResponse = {
        data: {
          access_token: 'test-access-token',
          id_token: 'test-id-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      const errorResponse = {
        response: {
          data: {
            error: 'invalid_token',
            error_description: 'The access token is invalid',
          },
          status: 401,
        },
      };

      mockHttpService.post.mockReturnValue(of(tokenResponse));
      mockHttpService.get.mockReturnValue(throwError(() => errorResponse));

      await expect(
        service.validateAuthorizationCode(validateCodeDto, mockRequest),
      ).rejects.toThrow(
        new HttpException(
          "Cannot read properties of undefined (reading 'error_description')",
          HttpStatus.UNAUTHORIZED,
        ),
      );
    });
  });

  describe('getUserInfo', () => {
    it('should return user information when access token is valid', async () => {
      const accessToken = 'valid-access-token';
      const expectedCognitoUrl = 'https://cognito-domain.com';

      mockConfigService.get.mockReturnValue(expectedCognitoUrl);

      const userInfoResponse: AxiosResponse = {
        data: {
          sub: 'test-sub',
          email: 'test@example.com',
          name: 'Test User',
          given_name: 'Test',
          family_name: 'User',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.get.mockReturnValue(of(userInfoResponse));

      const result = await service.getUserInfo(accessToken);

      expect(result).toEqual(userInfoResponse.data);
      expect(httpService.get).toHaveBeenCalledWith(
        'https://cognito-domain.com/oauth2/userInfo',
        expect.objectContaining({
          headers: { Authorization: 'Bearer valid-access-token' },
        }),
      );
    });

    it('should throw an error when access token is invalid', async () => {
      const accessToken = 'invalid-access-token';
      const expectedCognitoUrl = 'https://cognito-domain.com';

      mockConfigService.get.mockReturnValue(expectedCognitoUrl);

      const errorResponse = {
        response: {
          data: {
            error: 'invalid_token',
            error_description: 'The access token is invalid',
          },
          status: 401,
        },
      };

      mockHttpService.get.mockReturnValue(throwError(() => errorResponse));

      await expect(service.getUserInfo(accessToken)).rejects.toThrow(
        new HttpException(
          'Error retrieving user information',
          HttpStatus.UNAUTHORIZED,
        ),
      );
    });
  });
});
