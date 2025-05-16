import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { CognitoService } from '../cognito/cognito.service';
import { ProviderAuthDto } from '../dto/provider-auth.dto';
import { ValidateCodeDto } from '../dto/validate-code.dto';
import { CustomAuthDto } from '../dto/custom-auth.dto';
import { HttpException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
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

const mockTokenResponse: AxiosResponse = {
  data: {
    access_token: 'mock-access-token',
    id_token: 'mock-id-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    token_type: 'Bearer',
  },
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {
    headers: {} as any,
  },
};

const mockUserInfoResponse: AxiosResponse = {
  data: {
    sub: 'user123',
    email: 'test@example.com',
    name: 'Test User',
  },
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {
    headers: {} as any,
  },
};

describe('AuthService', () => {
  let service: AuthService;
  let httpService: HttpService;
  let configService: ConfigService;
  let cognitoService: CognitoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: HttpService,
          useValue: {
            post: jest.fn(),
            get: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const config = {
                COGNITO_URL: 'https://mock-cognito.com',
                AWS_REGION: 'us-east-1',
                AWS_ACCESS_KEY_ID: 'mock-access-key',
                AWS_SECRET_ACCESS_KEY: 'mock-secret-key',
                COGNITO_CLIENT_ID_USER: 'mock-client-id',
                COGNITO_CLIENT_SECRET_USER_PASS: 'mock-client-secret',
              };
              return config[key];
            }),
          },
        },
        {
          provide: CognitoService,
          useValue: {
            loginWithCustomPassword: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    httpService = module.get<HttpService>(HttpService);
    configService = module.get<ConfigService>(ConfigService);
    cognitoService = module.get<CognitoService>(CognitoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('authenticateWithProvider', () => {
    it('should return authentication URL for valid provider', async () => {
      const providerAuthDto: ProviderAuthDto = { provider: 'CGIAR-AzureAD' };

      const result = await service.authenticateWithProvider(
        providerAuthDto,
        mockRequest,
      );

      expect(configService.get).toHaveBeenCalledWith('COGNITO_URL');
      expect(result).toHaveProperty('authUrl');
      expect(result.authUrl).toContain('identity_provider=CGIAR-AzureAD');
      expect(result.authUrl).toContain('mock-client-id');
    });

    it('should throw exception when MIS metadata is missing', async () => {
      const providerAuthDto: ProviderAuthDto = { provider: 'CGIAR-AzureAD' };
      const requestWithoutMetadata = createMockRequest();
      requestWithoutMetadata.senderMisMetadata = null;

      await expect(
        service.authenticateWithProvider(
          providerAuthDto,
          requestWithoutMetadata,
        ),
      ).rejects.toThrow(HttpException);
    });

    it('should propagate errors', async () => {
      const providerAuthDto: ProviderAuthDto = { provider: 'CGIAR-AzureAD' };
      jest.spyOn(configService, 'get').mockImplementation(() => {
        throw new Error('Config error');
      });

      await expect(
        service.authenticateWithProvider(providerAuthDto, mockRequest),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('validateAuthorizationCode', () => {
    it('should validate code and return tokens and user info', async () => {
      const validateCodeDto: ValidateCodeDto = { code: 'mock-auth-code' };
      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(of(mockTokenResponse));
      jest
        .spyOn(service, 'getUserInfo')
        .mockResolvedValueOnce(mockUserInfoResponse.data);

      const result = await service.validateAuthorizationCode(
        validateCodeDto,
        mockRequest,
      );

      expect(httpService.post).toHaveBeenCalled();
      expect(service.getUserInfo).toHaveBeenCalledWith('mock-access-token');
      expect(result).toHaveProperty('accessToken', 'mock-access-token');
      expect(result).toHaveProperty('userInfo', mockUserInfoResponse.data);
    });

    it('should throw exception when MIS metadata is missing', async () => {
      const validateCodeDto: ValidateCodeDto = { code: 'mock-auth-code' };
      const requestWithoutMetadata = createMockRequest();
      requestWithoutMetadata.senderMisMetadata = null;

      await expect(
        service.validateAuthorizationCode(
          validateCodeDto,
          requestWithoutMetadata,
        ),
      ).rejects.toThrow(TypeError);
    });

    it('should handle API error responses', async () => {
      const validateCodeDto: ValidateCodeDto = { code: 'invalid-code' };
      const errorResponse = {
        response: {
          data: {
            error: 'invalid_grant',
            error_description: 'Invalid authorization code',
          },
          status: 400,
        },
      };
      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(throwError(() => errorResponse));

      await expect(
        service.validateAuthorizationCode(validateCodeDto, mockRequest),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('authenticateWithCustomPassword', () => {
    it('should authenticate with custom password and return tokens only', async () => {
      const customAuthDto: CustomAuthDto = {
        username: 'user@cgiar.org',
        password: 'password123',
      };

      const authResult = {
        AuthenticationResult: {
          AccessToken: 'mock-access-token',
          IdToken: 'mock-id-token',
          RefreshToken: 'mock-refresh-token',
          ExpiresIn: 3600,
          TokenType: 'Bearer',
        },
      };

      jest
        .spyOn(cognitoService, 'loginWithCustomPassword')
        .mockResolvedValueOnce(authResult);

      const result =
        await service.authenticateWithCustomPassword(customAuthDto);

      expect(cognitoService.loginWithCustomPassword).toHaveBeenCalledWith(
        customAuthDto.username,
        customAuthDto.password,
      );

      expect(result).toHaveProperty('tokens.accessToken', 'mock-access-token');
      expect(result).toHaveProperty('tokens.idToken', 'mock-id-token');
      expect(result).toHaveProperty(
        'tokens.refreshToken',
        'mock-refresh-token',
      );
    });

    it('should throw exception when authentication fails', async () => {
      const customAuthDto: CustomAuthDto = {
        username: 'user@cgiar.org',
        password: 'wrong-password',
      };

      jest
        .spyOn(cognitoService, 'loginWithCustomPassword')
        .mockRejectedValueOnce(new Error('Authentication failed'));

      await expect(
        service.authenticateWithCustomPassword(customAuthDto),
      ).rejects.toThrow(HttpException);
      expect(cognitoService.loginWithCustomPassword).toHaveBeenCalledWith(
        customAuthDto.username,
        customAuthDto.password,
      );
    });
  });

  describe('getUserInfo', () => {
    it('should fetch user info with access token', async () => {
      const accessToken = 'mock-access-token';
      jest
        .spyOn(httpService, 'get')
        .mockReturnValueOnce(of(mockUserInfoResponse));

      const result = await service.getUserInfo(accessToken);

      expect(httpService.get).toHaveBeenCalledWith(
        'https://mock-cognito.com/oauth2/userInfo',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      expect(result).toEqual(mockUserInfoResponse.data);
    });

    it('should throw exception when user info fetch fails', async () => {
      const accessToken = 'invalid-token';
      jest
        .spyOn(httpService, 'get')
        .mockReturnValueOnce(throwError(() => new Error('Invalid token')));

      await expect(service.getUserInfo(accessToken)).rejects.toThrow(
        HttpException,
      );
    });
  });
});
