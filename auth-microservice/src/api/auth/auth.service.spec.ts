import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { CognitoService } from './cognito/cognito.service';
import { ProviderAuthDto } from './dto/provider-auth.dto';
import { ValidateCodeDto } from './dto/validate-code.dto';
import { CustomAuthDto } from './dto/custom-auth.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { HttpException, HttpStatus } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { RequestWithCustomAttrs } from '../../middleware/jwt-clarisa.middleware';

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
            createUser: jest.fn(),
            updateUser: jest.fn(),
            changeUserPassword: jest.fn(),
            validateAccessToken: jest.fn(),
            refreshAccessToken: jest.fn(),
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

    it('should throw exception when mis_auth is missing', async () => {
      const providerAuthDto: ProviderAuthDto = { provider: 'CGIAR-AzureAD' };
      const requestWithoutAuth = createMockRequest();
      requestWithoutAuth.senderMisMetadata = {
        id: null,
        name: null,
        acronym: null,
        main_contact_point_id: null,
        environment_id: null,
      };

      await expect(
        service.authenticateWithProvider(providerAuthDto, requestWithoutAuth),
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

    it('should handle network errors', async () => {
      const validateCodeDto: ValidateCodeDto = { code: 'mock-auth-code' };
      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(throwError(() => new Error('Network error')));

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

  // NUEVOS TESTS AGREGADOS A PARTIR DE AQUÍ

  describe('registerUser', () => {
    it('should register user successfully', async () => {
      const registerUserDto: RegisterUserDto = {
        username: 'newuser@example.com',
        temporaryPassword: 'TempPass123!',
        firstName: 'New',
        lastName: 'User',
        email: 'newuser@example.com',
        sendEmail: false,
      };

      const mockCreateUserResult = {
        userSub: 'new-user-123',
        enabled: true,
        userStatus: 'FORCE_CHANGE_PASSWORD',
      };

      jest
        .spyOn(cognitoService, 'createUser')
        .mockResolvedValueOnce(mockCreateUserResult);

      const result = await service.registerUser(registerUserDto, mockRequest);

      expect(result).toEqual({
        message: 'User registered successfully',
        userSub: 'new-user-123',
        temporaryPassword: true,
      });

      expect(cognitoService.createUser).toHaveBeenCalledWith(
        registerUserDto.username,
        registerUserDto.temporaryPassword,
        registerUserDto.firstName,
        registerUserDto.lastName,
        registerUserDto.email,
        false,
      );
    });

    it('should register user with sendEmail enabled', async () => {
      const registerUserDto: RegisterUserDto = {
        username: 'newuser@example.com',
        temporaryPassword: 'TempPass123!',
        firstName: 'New',
        lastName: 'User',
        email: 'newuser@example.com',
        sendEmail: true,
      };

      const mockCreateUserResult = {
        userSub: 'new-user-123',
        enabled: true,
        userStatus: 'FORCE_CHANGE_PASSWORD',
      };

      jest
        .spyOn(cognitoService, 'createUser')
        .mockResolvedValueOnce(mockCreateUserResult);

      await service.registerUser(registerUserDto, mockRequest);

      expect(cognitoService.createUser).toHaveBeenCalledWith(
        registerUserDto.username,
        registerUserDto.temporaryPassword,
        registerUserDto.firstName,
        registerUserDto.lastName,
        registerUserDto.email,
        true,
      );
    });

    it('should throw error when MIS metadata is missing', async () => {
      const registerUserDto: RegisterUserDto = {
        username: 'newuser@example.com',
        temporaryPassword: 'TempPass123!',
        firstName: 'New',
        lastName: 'User',
        email: 'newuser@example.com',
      };

      const requestWithoutMis = createMockRequest();
      requestWithoutMis.senderMisMetadata = null;

      await expect(
        service.registerUser(registerUserDto, requestWithoutMis),
      ).rejects.toThrow(HttpException);
    });

    it('should handle Cognito errors', async () => {
      const registerUserDto: RegisterUserDto = {
        username: 'existing@example.com',
        temporaryPassword: 'TempPass123!',
        firstName: 'Existing',
        lastName: 'User',
        email: 'existing@example.com',
      };

      jest
        .spyOn(cognitoService, 'createUser')
        .mockRejectedValueOnce(
          new HttpException('User already exists', HttpStatus.BAD_REQUEST),
        );

      await expect(
        service.registerUser(registerUserDto, mockRequest),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const updateUserDto: UpdateUserDto = {
        username: 'user@example.com',
        firstName: 'Updated',
        lastName: 'Name',
        email: 'updated@example.com',
      };

      jest.spyOn(cognitoService, 'updateUser').mockResolvedValueOnce(undefined);

      const result = await service.updateUser(updateUserDto, mockRequest);

      expect(result).toEqual({
        message: 'User updated successfully',
        username: 'user@example.com',
      });

      expect(cognitoService.updateUser).toHaveBeenCalledWith(updateUserDto);
    });

    it('should throw error when MIS metadata is missing', async () => {
      const updateUserDto: UpdateUserDto = {
        username: 'user@example.com',
        firstName: 'Updated',
        lastName: 'Name',
      };

      const requestWithoutMis = createMockRequest();
      requestWithoutMis.senderMisMetadata = null;

      await expect(
        service.updateUser(updateUserDto, requestWithoutMis),
      ).rejects.toThrow(HttpException);
    });

    it('should handle Cognito errors', async () => {
      const updateUserDto: UpdateUserDto = {
        username: 'nonexistent@example.com',
        firstName: 'Updated',
        lastName: 'Name',
      };

      jest
        .spyOn(cognitoService, 'updateUser')
        .mockRejectedValueOnce(
          new HttpException('User not found', HttpStatus.BAD_REQUEST),
        );

      await expect(
        service.updateUser(updateUserDto, mockRequest),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const changePasswordDto: ChangePasswordDto = {
        username: 'user@example.com',
        currentPassword: 'OldPass123!',
        newPassword: 'NewPass123!',
      };

      jest
        .spyOn(cognitoService, 'changeUserPassword')
        .mockResolvedValueOnce(undefined);

      const result = await service.changePassword(
        changePasswordDto,
        mockRequest,
      );

      expect(result).toEqual({
        message: 'Password changed successfully',
        username: 'user@example.com',
      });

      expect(cognitoService.changeUserPassword).toHaveBeenCalledWith(
        changePasswordDto.username,
        changePasswordDto.currentPassword,
        changePasswordDto.newPassword,
        mockRequest.senderMisMetadata.mis_auth.cognito_client_id,
        mockRequest.senderMisMetadata.mis_auth.cognito_client_secret,
      );
    });

    it('should throw error for incorrect current password', async () => {
      const changePasswordDto: ChangePasswordDto = {
        username: 'user@example.com',
        currentPassword: 'WrongPass123!',
        newPassword: 'NewPass123!',
      };

      jest
        .spyOn(cognitoService, 'changeUserPassword')
        .mockRejectedValueOnce(
          new HttpException(
            'Current password is incorrect',
            HttpStatus.UNAUTHORIZED,
          ),
        );

      await expect(
        service.changePassword(changePasswordDto, mockRequest),
      ).rejects.toThrow(HttpException);
    });

    it('should handle missing MIS metadata', async () => {
      const changePasswordDto: ChangePasswordDto = {
        username: 'user@example.com',
        currentPassword: 'OldPass123!',
        newPassword: 'NewPass123!',
      };

      const requestWithoutMis = createMockRequest();
      requestWithoutMis.senderMisMetadata = null;

      await expect(
        service.changePassword(changePasswordDto, requestWithoutMis),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('validateToken', () => {
    it('should validate token successfully', async () => {
      const accessToken = 'valid-access-token';

      const mockTokenInfo = {
        username: 'test@example.com',
        userAttributes: [],
        exp: 1647891234,
        token_use: 'access',
        client_id: 'test-client-id',
      };

      jest
        .spyOn(cognitoService, 'validateAccessToken')
        .mockResolvedValueOnce(mockTokenInfo);
      jest
        .spyOn(service, 'getUserInfo')
        .mockResolvedValueOnce(mockUserInfoResponse.data);

      const result = await service.validateToken(accessToken);

      expect(result).toEqual({
        valid: true,
        userInfo: mockUserInfoResponse.data,
        expiresAt: mockTokenInfo.exp,
        tokenUse: mockTokenInfo.token_use,
        clientId: mockTokenInfo.client_id,
      });

      expect(cognitoService.validateAccessToken).toHaveBeenCalledWith(
        accessToken,
      );
    });

    it('should return invalid result for expired token', async () => {
      const accessToken = 'expired-token';

      const expiredError = new Error('TokenExpiredError');
      expiredError.name = 'TokenExpiredError';

      jest
        .spyOn(cognitoService, 'validateAccessToken')
        .mockRejectedValueOnce(expiredError);

      const result = await service.validateToken(accessToken);

      expect(result).toEqual({
        valid: false,
        error: 'Token expired or invalid',
        code: 'TOKEN_EXPIRED',
      });
    });

    it('should return invalid result for unauthorized token', async () => {
      const accessToken = 'unauthorized-token';

      const unauthorizedError = new Error('NotAuthorizedException');
      unauthorizedError.name = 'NotAuthorizedException';

      jest
        .spyOn(cognitoService, 'validateAccessToken')
        .mockRejectedValueOnce(unauthorizedError);

      const result = await service.validateToken(accessToken);

      expect(result).toEqual({
        valid: false,
        error: 'Token expired or invalid',
        code: 'TOKEN_EXPIRED',
      });
    });

    it('should throw error for missing access token', async () => {
      await expect(service.validateToken('')).rejects.toThrow(
        new HttpException('Access token is required', HttpStatus.BAD_REQUEST),
      );
    });

    it('should handle other validation errors', async () => {
      const accessToken = 'malformed-token';

      jest
        .spyOn(cognitoService, 'validateAccessToken')
        .mockRejectedValueOnce(new Error('Invalid token format'));

      await expect(service.validateToken(accessToken)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('refreshAuthenticationTokens', () => {
    it('should refresh tokens successfully', async () => {
      const refreshToken = 'valid-refresh-token';

      const mockNewTokens = {
        accessToken: 'new-access-token',
        idToken: 'new-id-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 3600,
        tokenType: 'Bearer',
      };

      jest
        .spyOn(cognitoService, 'refreshAccessToken')
        .mockResolvedValueOnce(mockNewTokens);
      jest
        .spyOn(service, 'getUserInfo')
        .mockResolvedValueOnce(mockUserInfoResponse.data);

      const result = await service.refreshAuthenticationTokens(
        refreshToken,
        mockRequest,
      );

      expect(result).toEqual({
        accessToken: mockNewTokens.accessToken,
        idToken: mockNewTokens.idToken,
        refreshToken: mockNewTokens.refreshToken,
        expiresIn: mockNewTokens.expiresIn,
        tokenType: mockNewTokens.tokenType,
        userInfo: mockUserInfoResponse.data,
      });

      expect(cognitoService.refreshAccessToken).toHaveBeenCalledWith(
        refreshToken,
        mockRequest.senderMisMetadata.mis_auth.cognito_client_id,
        mockRequest.senderMisMetadata.mis_auth.cognito_client_secret,
      );
    });

    it('should handle expired refresh token', async () => {
      const refreshToken = 'expired-refresh-token';

      const expiredError = new Error('NotAuthorizedException');
      expiredError.name = 'NotAuthorizedException';

      jest
        .spyOn(cognitoService, 'refreshAccessToken')
        .mockRejectedValueOnce(expiredError);

      await expect(
        service.refreshAuthenticationTokens(refreshToken, mockRequest),
      ).rejects.toThrow(
        new HttpException(
          'Refresh token has expired. Please login again.',
          HttpStatus.UNAUTHORIZED,
        ),
      );
    });

    it('should handle token refresh with same refresh token', async () => {
      const refreshToken = 'valid-refresh-token';

      const mockNewTokens = {
        accessToken: 'new-access-token',
        idToken: 'new-id-token',
        refreshToken: null, // Cognito didn't return new refresh token
        expiresIn: 3600,
        tokenType: 'Bearer',
      };

      jest
        .spyOn(cognitoService, 'refreshAccessToken')
        .mockResolvedValueOnce(mockNewTokens);
      jest
        .spyOn(service, 'getUserInfo')
        .mockResolvedValueOnce(mockUserInfoResponse.data);

      const result = await service.refreshAuthenticationTokens(
        refreshToken,
        mockRequest,
      );

      expect(result.refreshToken).toBe(refreshToken); // Should use original refresh token
    });

    it('should handle HTTP response errors', async () => {
      const refreshToken = 'valid-refresh-token';

      const httpError = {
        response: {
          data: {
            error: 'invalid_grant',
            error_description: 'Refresh token expired',
          },
        },
      };

      jest
        .spyOn(cognitoService, 'refreshAccessToken')
        .mockRejectedValueOnce(httpError);

      await expect(
        service.refreshAuthenticationTokens(refreshToken, mockRequest),
      ).rejects.toThrow(
        new HttpException(
          'Token refresh failed: Refresh token expired',
          HttpStatus.UNAUTHORIZED,
        ),
      );
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null/undefined values gracefully', async () => {
      const providerAuthDto: ProviderAuthDto = {
        provider: null as any,
      };

      const result = await service.authenticateWithProvider(
        providerAuthDto,
        mockRequest,
      );

      expect(result).toBeDefined();
      expect(result.authUrl).toContain('identity_provider=null');
    });

    it('should handle empty strings in DTOs', async () => {
      const customAuthDto: CustomAuthDto = {
        username: '',
        password: '',
      };

      jest
        .spyOn(cognitoService, 'loginWithCustomPassword')
        .mockRejectedValueOnce(new Error('Invalid input'));

      await expect(
        service.authenticateWithCustomPassword(customAuthDto),
      ).rejects.toThrow(HttpException);
    });

    it('should handle concurrent requests', async () => {
      const accessToken1 = 'token-1';
      const accessToken2 = 'token-2';

      const mockUserInfo1 = { ...mockUserInfoResponse.data, sub: 'user-1' };
      const mockUserInfo2 = { ...mockUserInfoResponse.data, sub: 'user-2' };

      jest
        .spyOn(httpService, 'get')
        .mockReturnValueOnce(
          of({ ...mockUserInfoResponse, data: mockUserInfo1 }),
        )
        .mockReturnValueOnce(
          of({ ...mockUserInfoResponse, data: mockUserInfo2 }),
        );

      const [result1, result2] = await Promise.all([
        service.getUserInfo(accessToken1),
        service.getUserInfo(accessToken2),
      ]);

      expect(result1.sub).toBe('user-1');
      expect(result2.sub).toBe('user-2');
    });

    it('should handle malformed JSON responses', async () => {
      const accessToken = 'valid-token';

      jest
        .spyOn(httpService, 'get')
        .mockReturnValueOnce(
          throwError(() => new SyntaxError('Unexpected token')),
        );

      await expect(service.getUserInfo(accessToken)).rejects.toThrow(
        HttpException,
      );
    });

    it('should handle network timeouts', async () => {
      const validateCodeDto: ValidateCodeDto = {
        code: 'auth-code',
      };

      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(throwError(() => ({ code: 'ETIMEDOUT' })));

      await expect(
        service.validateAuthorizationCode(validateCodeDto, mockRequest),
      ).rejects.toThrow(HttpException);
    });
  });
});
