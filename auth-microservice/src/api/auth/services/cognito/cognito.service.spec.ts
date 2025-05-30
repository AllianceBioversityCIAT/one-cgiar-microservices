import { Test, TestingModule } from '@nestjs/testing';
import { CognitoService } from './cognito.service';
import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus } from '@nestjs/common';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminUpdateUserAttributesCommand,
  ChangePasswordCommand,
  GetUserCommand,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { UpdateUserDto } from '../../dto/update-user.dto';

global.fetch = jest.fn();

jest.mock('@aws-sdk/client-cognito-identity-provider', () => {
  const originalModule = jest.requireActual(
    '@aws-sdk/client-cognito-identity-provider',
  );

  return {
    ...originalModule,
    CognitoIdentityProviderClient: jest.fn().mockImplementation(() => ({
      send: jest.fn(),
    })),
    AdminCreateUserCommand: jest.fn(),
    AdminUpdateUserAttributesCommand: jest.fn(),
    ChangePasswordCommand: jest.fn(),
    GetUserCommand: jest.fn(),
    InitiateAuthCommand: jest.fn(),
  };
});

jest.mock('crypto', () => {
  return {
    createHmac: jest.fn().mockImplementation(() => ({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('mocked-hash-value'),
    })),
  };
});

describe('CognitoService', () => {
  let service: CognitoService;
  let configService: ConfigService;
  let cognitoClient: any;

  const mockConfig = {
    AWS_REGION: 'us-east-1',
    AWS_ACCESS_KEY_ID: 'mock-access-key',
    AWS_SECRET_ACCESS_KEY: 'mock-secret-key',
    COGNITO_CLIENT_ID_USER: 'mock-client-id',
    COGNITO_CLIENT_SECRET_USER_PASS: 'mock-client-secret',
    COGNITO_USER_POOL_URL: 'https://cognito-idp.us-east-1.amazonaws.com/',
    COGNITO_USER_POOL_ID: 'us-east-1_TEST123',
  };

  const mockAuthResult = {
    AuthenticationResult: {
      AccessToken: 'mock-access-token',
      IdToken: 'mock-id-token',
      RefreshToken: 'mock-refresh-token',
      ExpiresIn: 3600,
      TokenType: 'Bearer',
    },
  };

  const mockUserResponse = {
    User: {
      Username: 'test-user-123',
      Enabled: true,
      UserStatus: 'CONFIRMED',
    },
  };

  const mockGetUserResponse = {
    Username: 'test@example.com',
    UserAttributes: [
      { Name: 'email', Value: 'test@example.com' },
      { Name: 'given_name', Value: 'Test' },
      { Name: 'family_name', Value: 'User' },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CognitoService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => mockConfig[key]),
          },
        },
      ],
    }).compile();

    service = module.get<CognitoService>(CognitoService);
    configService = module.get<ConfigService>(ConfigService);
    cognitoClient = service['cognitoClient'];

    (global.fetch as jest.Mock).mockReset();
    cognitoClient.send.mockReset();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor', () => {
    it('should create a CognitoIdentityProviderClient with correct config', () => {
      expect(CognitoIdentityProviderClient).toHaveBeenCalledWith({
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'mock-access-key',
          secretAccessKey: 'mock-secret-key',
        },
      });
    });
  });

  describe('calculateSecretHash', () => {
    it('should calculate secret hash correctly', () => {
      const username = 'test@example.com';
      const clientId = 'test-client-id';
      const clientSecret = 'test-client-secret';

      const result = service['calculateSecretHash'](
        username,
        clientId,
        clientSecret,
      );

      expect(result).toBe('mocked-hash-value');
    });

    it('should handle empty username for refresh tokens', () => {
      const username = '';
      const clientId = 'test-client-id';
      const clientSecret = 'test-client-secret';

      const result = service['calculateSecretHash'](
        username,
        clientId,
        clientSecret,
      );

      expect(result).toBe('mocked-hash-value');
    });
  });

  describe('loginWithCustomPassword', () => {
    it('should call fetch with correct parameters', async () => {
      const username = 'test@example.com';
      const password = 'password123';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockAuthResult),
      });

      const result = await service.loginWithCustomPassword(username, password);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://cognito-idp.us-east-1.amazonaws.com/',
        {
          method: 'POST',
          headers: {
            'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
            'Content-Type': 'application/x-amz-json-1.1',
          },
          body: JSON.stringify({
            AuthFlow: 'USER_PASSWORD_AUTH',
            ClientId: 'mock-client-id',
            AuthParameters: {
              USERNAME: username,
              PASSWORD: password,
              SECRET_HASH: 'mocked-hash-value',
            },
          }),
        },
      );

      expect(result).toEqual(mockAuthResult);
    });

    it('should use calculated secretHash in the auth parameters', async () => {
      const username = 'test@example.com';
      const password = 'password123';
      const clientId = 'mock-client-id';
      const clientSecret = 'mock-client-secret';
      const expectedSecretHash = 'calculated-secret-hash';

      const calculateSecretHashSpy = jest
        .spyOn<any, any>(service, 'calculateSecretHash')
        .mockReturnValue(expectedSecretHash);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockAuthResult),
      });

      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        const config = {
          ...mockConfig,
          COGNITO_CLIENT_ID_USER: clientId,
          COGNITO_CLIENT_SECRET_USER_PASS: clientSecret,
        };
        return config[key];
      });

      await service.loginWithCustomPassword(username, password);

      expect(calculateSecretHashSpy).toHaveBeenCalledWith(
        username,
        clientId,
        clientSecret,
      );

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining(expectedSecretHash),
        }),
      );
    });

    it('should throw exception when authentication fails', async () => {
      const username = 'test@example.com';
      const password = 'wrong-password';

      const errorResponse = {
        __type: 'NotAuthorizedException',
        message: 'Incorrect username or password.',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValueOnce(errorResponse),
      });

      await expect(
        service.loginWithCustomPassword(username, password),
      ).rejects.toThrow(HttpException);

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should handle fetch network errors', async () => {
      const username = 'test@example.com';
      const password = 'password123';

      (global.fetch as jest.Mock).mockRejectedValue(
        new Error('Network connection failed'),
      );

      await expect(
        service.loginWithCustomPassword(username, password),
      ).rejects.toThrow(
        new HttpException('Network connection failed', HttpStatus.UNAUTHORIZED),
      );
    });

    it('should handle non-JSON error responses', async () => {
      const username = 'test@example.com';
      const password = 'password123';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      });

      await expect(
        service.loginWithCustomPassword(username, password),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('createUser', () => {
    const userData = {
      username: 'newuser@example.com',
      temporaryPassword: 'TempPass123!',
      firstName: 'New',
      lastName: 'User',
      email: 'newuser@example.com',
    };

    it('should create user successfully', async () => {
      cognitoClient.send.mockResolvedValue(mockUserResponse);

      const result = await service.createUser(
        userData.username,
        userData.temporaryPassword,
        userData.firstName,
        userData.lastName,
        userData.email,
      );

      expect(result).toEqual({
        userSub: mockUserResponse.User.Username,
        enabled: mockUserResponse.User.Enabled,
        userStatus: mockUserResponse.User.UserStatus,
      });

      expect(cognitoClient.send).toHaveBeenCalledWith(
        expect.any(AdminCreateUserCommand),
      );
    });

    it('should create user with email sending enabled', async () => {
      cognitoClient.send.mockResolvedValue(mockUserResponse);

      await service.createUser(
        userData.username,
        userData.temporaryPassword,
        userData.firstName,
        userData.lastName,
        userData.email,
      );

      expect(AdminCreateUserCommand).toHaveBeenCalledWith({
        UserPoolId: mockConfig.COGNITO_USER_POOL_ID,
        Username: userData.username,
        TemporaryPassword: userData.temporaryPassword,
        UserAttributes: [
          { Name: 'email', Value: userData.email },
          { Name: 'given_name', Value: userData.firstName },
          { Name: 'family_name', Value: userData.lastName },
          { Name: 'email_verified', Value: 'true' },
        ],
      });
    });

    it('should create user with email sending suppressed', async () => {
      cognitoClient.send.mockResolvedValue(mockUserResponse);

      await service.createUser(
        userData.username,
        userData.temporaryPassword,
        userData.firstName,
        userData.lastName,
        userData.email,
      );

      expect(AdminCreateUserCommand).toHaveBeenCalledWith({
        UserPoolId: mockConfig.COGNITO_USER_POOL_ID,
        Username: userData.username,
        TemporaryPassword: userData.temporaryPassword,
        UserAttributes: [
          { Name: 'email', Value: userData.email },
          { Name: 'given_name', Value: userData.firstName },
          { Name: 'family_name', Value: userData.lastName },
          { Name: 'email_verified', Value: 'true' },
        ],
      });
    });

    it('should handle user already exists error', async () => {
      const userExistsError = new Error('User already exists');
      userExistsError.name = 'UsernameExistsException';

      cognitoClient.send.mockRejectedValue(userExistsError);

      await expect(
        service.createUser(
          userData.username,
          userData.temporaryPassword,
          userData.firstName,
          userData.lastName,
          userData.email,
        ),
      ).rejects.toThrow(
        new HttpException('User already exists', HttpStatus.BAD_REQUEST),
      );
    });

    it('should handle invalid password policy error', async () => {
      const passwordError = new Error('Password does not conform to policy');
      passwordError.name = 'InvalidPasswordException';

      cognitoClient.send.mockRejectedValue(passwordError);

      await expect(
        service.createUser(
          userData.username,
          'weak',
          userData.firstName,
          userData.lastName,
          userData.email,
        ),
      ).rejects.toThrow(
        new HttpException(
          'Password does not conform to policy',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should include all required user attributes', async () => {
      cognitoClient.send.mockResolvedValue(mockUserResponse);

      await service.createUser(
        userData.username,
        userData.temporaryPassword,
        userData.firstName,
        userData.lastName,
        userData.email,
      );

      expect(AdminCreateUserCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          UserAttributes: expect.arrayContaining([
            { Name: 'email', Value: userData.email },
            { Name: 'given_name', Value: userData.firstName },
            { Name: 'family_name', Value: userData.lastName },
            { Name: 'email_verified', Value: 'true' },
          ]),
        }),
      );
    });
  });

  describe('updateUser', () => {
    it('should update user attributes successfully', async () => {
      const updateUserDto: UpdateUserDto = {
        username: 'user@example.com',
        firstName: 'Updated',
        lastName: 'Name',
        email: 'updated@example.com',
        phoneNumber: '+1234567890',
      };

      cognitoClient.send.mockResolvedValue({});

      await service.updateUser(updateUserDto);

      expect(cognitoClient.send).toHaveBeenCalledWith(
        expect.any(AdminUpdateUserAttributesCommand),
      );

      expect(AdminUpdateUserAttributesCommand).toHaveBeenCalledWith({
        UserPoolId: mockConfig.COGNITO_USER_POOL_ID,
        Username: updateUserDto.username,
        UserAttributes: expect.arrayContaining([
          { Name: 'given_name', Value: 'Updated' },
          { Name: 'family_name', Value: 'Name' },
          { Name: 'email', Value: 'updated@example.com' },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'phone_number', Value: '+1234567890' },
        ]),
      });
    });

    it('should update only provided attributes', async () => {
      const partialUpdateDto: UpdateUserDto = {
        username: 'user@example.com',
        firstName: 'OnlyFirst',
      };

      cognitoClient.send.mockResolvedValue({});

      await service.updateUser(partialUpdateDto);

      expect(AdminUpdateUserAttributesCommand).toHaveBeenCalledWith({
        UserPoolId: mockConfig.COGNITO_USER_POOL_ID,
        Username: partialUpdateDto.username,
        UserAttributes: [{ Name: 'given_name', Value: 'OnlyFirst' }],
      });
    });

    it('should throw error when no attributes to update', async () => {
      const emptyUpdateDto: UpdateUserDto = {
        username: 'user@example.com',
      };

      await expect(service.updateUser(emptyUpdateDto)).rejects.toThrow(
        new HttpException('No attributes to update', HttpStatus.BAD_REQUEST),
      );

      expect(cognitoClient.send).not.toHaveBeenCalled();
    });

    it('should handle user not found error', async () => {
      const updateUserDto: UpdateUserDto = {
        username: 'nonexistent@example.com',
        firstName: 'Test',
      };

      const userNotFoundError = new Error('User does not exist');
      userNotFoundError.name = 'UserNotFoundException';

      cognitoClient.send.mockRejectedValue(userNotFoundError);

      await expect(service.updateUser(updateUserDto)).rejects.toThrow(
        new HttpException('User does not exist', HttpStatus.BAD_REQUEST),
      );
    });

    it('should handle invalid attribute value error', async () => {
      const updateUserDto: UpdateUserDto = {
        username: 'user@example.com',
        email: 'invalid-email-format',
      };

      const invalidAttributeError = new Error('Invalid email format');
      invalidAttributeError.name = 'InvalidParameterException';

      cognitoClient.send.mockRejectedValue(invalidAttributeError);

      await expect(service.updateUser(updateUserDto)).rejects.toThrow(
        new HttpException('Invalid email format', HttpStatus.BAD_REQUEST),
      );
    });
  });

  describe('changeUserPassword', () => {
    const passwordData = {
      username: 'user@example.com',
      currentPassword: 'OldPass123!',
      newPassword: 'NewPass123!',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    };

    it('should change password successfully', async () => {
      cognitoClient.send.mockResolvedValueOnce(mockAuthResult);

      cognitoClient.send.mockResolvedValueOnce({});

      await service.changeUserPassword(
        passwordData.username,
        passwordData.currentPassword,
        passwordData.newPassword,
        passwordData.clientId,
        passwordData.clientSecret,
      );

      expect(cognitoClient.send).toHaveBeenCalledTimes(2);
      expect(cognitoClient.send).toHaveBeenNthCalledWith(
        1,
        expect.any(InitiateAuthCommand),
      );
      expect(cognitoClient.send).toHaveBeenNthCalledWith(
        2,
        expect.any(ChangePasswordCommand),
      );
    });

    it('should throw error for incorrect current password', async () => {
      const authError = new Error('Incorrect username or password');
      authError.name = 'NotAuthorizedException';

      cognitoClient.send.mockRejectedValue(authError);

      await expect(
        service.changeUserPassword(
          passwordData.username,
          'wrongpassword',
          passwordData.newPassword,
          passwordData.clientId,
          passwordData.clientSecret,
        ),
      ).rejects.toThrow(
        new HttpException(
          'Current password is incorrect',
          HttpStatus.UNAUTHORIZED,
        ),
      );
    });

    it('should throw error when authentication result is missing', async () => {
      const invalidAuthResponse = {};
      cognitoClient.send.mockResolvedValue(invalidAuthResponse);

      await expect(
        service.changeUserPassword(
          passwordData.username,
          passwordData.currentPassword,
          passwordData.newPassword,
          passwordData.clientId,
          passwordData.clientSecret,
        ),
      ).rejects.toThrow(
        new HttpException(
          'Current password is incorrect',
          HttpStatus.UNAUTHORIZED,
        ),
      );
    });

    it('should handle password policy errors during change', async () => {
      cognitoClient.send.mockResolvedValueOnce(mockAuthResult);

      const passwordPolicyError = new Error(
        'Password does not conform to policy',
      );
      passwordPolicyError.name = 'InvalidPasswordException';

      cognitoClient.send.mockRejectedValueOnce(passwordPolicyError);

      await expect(
        service.changeUserPassword(
          passwordData.username,
          passwordData.currentPassword,
          'weak',
          passwordData.clientId,
          passwordData.clientSecret,
        ),
      ).rejects.toThrow(
        new HttpException(
          'Password does not conform to policy',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should use correct secret hash for authentication', async () => {
      cognitoClient.send.mockResolvedValueOnce(mockAuthResult);
      cognitoClient.send.mockResolvedValueOnce({});

      await service.changeUserPassword(
        passwordData.username,
        passwordData.currentPassword,
        passwordData.newPassword,
        passwordData.clientId,
        passwordData.clientSecret,
      );

      expect(InitiateAuthCommand).toHaveBeenCalledWith({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: passwordData.clientId,
        AuthParameters: {
          USERNAME: passwordData.username,
          PASSWORD: passwordData.currentPassword,
          SECRET_HASH: 'mocked-hash-value',
        },
      });
    });
  });

  describe('validateAccessToken', () => {
    const mockAccessToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE2NDc4OTEyMzQsInRva2VuX3VzZSI6ImFjY2VzcyIsImNsaWVudF9pZCI6InRlc3QtY2xpZW50LWlkIn0.signature';

    it('should validate access token successfully', async () => {
      cognitoClient.send.mockResolvedValue(mockGetUserResponse);

      const result = await service.validateAccessToken(mockAccessToken);

      expect(result).toEqual({
        username: mockGetUserResponse.Username,
        userAttributes: mockGetUserResponse.UserAttributes,
        exp: 1647891234,
        token_use: 'access',
        client_id: 'test-client-id',
      });

      expect(cognitoClient.send).toHaveBeenCalledWith(
        expect.any(GetUserCommand),
      );
    });

    it('should throw error for expired token', async () => {
      const expiredTokenError = new Error('Token has expired');
      expiredTokenError.name = 'NotAuthorizedException';

      cognitoClient.send.mockRejectedValue(expiredTokenError);

      await expect(
        service.validateAccessToken(mockAccessToken),
      ).rejects.toThrow(
        new HttpException(
          'Access token has expired or is invalid',
          HttpStatus.UNAUTHORIZED,
        ),
      );
    });

    it('should handle malformed token', async () => {
      const malformedToken = 'invalid.token.format';

      await expect(service.validateAccessToken(malformedToken)).rejects.toThrow(
        new HttpException('Invalid token format', HttpStatus.UNAUTHORIZED),
      );
    });

    it('should handle token without required claims', async () => {
      const tokenWithoutClaims =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature';

      jest.spyOn<any, any>(service, 'decodeJwtToken').mockReturnValue({
        sub: '1234567890',
      });

      cognitoClient.send.mockRejectedValue(new Error('Invalid token'));

      await expect(
        service.validateAccessToken(tokenWithoutClaims),
      ).rejects.toThrow(
        new HttpException('Invalid token', HttpStatus.UNAUTHORIZED),
      );
    });

    it('should handle empty token', async () => {
      await expect(service.validateAccessToken('')).rejects.toThrow();
    });
  });

  describe('refreshAccessToken', () => {
    const refreshData = {
      refreshToken: 'valid-refresh-token',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    };

    it('should refresh access token successfully', async () => {
      const mockRefreshResponse = {
        AuthenticationResult: {
          AccessToken: 'new-access-token',
          IdToken: 'new-id-token',
          RefreshToken: 'new-refresh-token',
          ExpiresIn: 3600,
          TokenType: 'Bearer',
        },
      };

      cognitoClient.send.mockResolvedValue(mockRefreshResponse);

      const result = await service.refreshAccessToken(
        refreshData.refreshToken,
        refreshData.clientId,
        refreshData.clientSecret,
      );

      expect(result).toEqual({
        accessToken: mockRefreshResponse.AuthenticationResult.AccessToken,
        idToken: mockRefreshResponse.AuthenticationResult.IdToken,
        refreshToken: mockRefreshResponse.AuthenticationResult.RefreshToken,
        expiresIn: mockRefreshResponse.AuthenticationResult.ExpiresIn,
        tokenType: mockRefreshResponse.AuthenticationResult.TokenType,
      });

      expect(cognitoClient.send).toHaveBeenCalledWith(
        expect.any(InitiateAuthCommand),
      );
    });

    it('should handle expired refresh token', async () => {
      const expiredRefreshError = new Error('Refresh token has expired');
      expiredRefreshError.name = 'NotAuthorizedException';

      cognitoClient.send.mockRejectedValue(expiredRefreshError);

      await expect(
        service.refreshAccessToken(
          'expired-refresh-token',
          refreshData.clientId,
          refreshData.clientSecret,
        ),
      ).rejects.toThrow(
        new HttpException(
          'Refresh token has expired or is invalid',
          HttpStatus.UNAUTHORIZED,
        ),
      );
    });

    it('should handle missing authentication result', async () => {
      const invalidRefreshResponse = {};
      cognitoClient.send.mockResolvedValue(invalidRefreshResponse);

      await expect(
        service.refreshAccessToken(
          refreshData.refreshToken,
          refreshData.clientId,
          refreshData.clientSecret,
        ),
      ).rejects.toThrow(
        new HttpException(
          'Refresh token is invalid or expired',
          HttpStatus.UNAUTHORIZED,
        ),
      );
    });

    it('should handle null refresh token in response', async () => {
      const mockRefreshResponse = {
        AuthenticationResult: {
          AccessToken: 'new-access-token',
          IdToken: 'new-id-token',
          RefreshToken: null,
          ExpiresIn: 3600,
          TokenType: 'Bearer',
        },
      };

      cognitoClient.send.mockResolvedValue(mockRefreshResponse);

      const result = await service.refreshAccessToken(
        refreshData.refreshToken,
        refreshData.clientId,
        refreshData.clientSecret,
      );

      expect(result.refreshToken).toBeNull();
    });

    it('should use correct auth flow for refresh', async () => {
      const mockRefreshResponse = {
        AuthenticationResult: mockAuthResult.AuthenticationResult,
      };

      cognitoClient.send.mockResolvedValue(mockRefreshResponse);

      await service.refreshAccessToken(
        refreshData.refreshToken,
        refreshData.clientId,
        refreshData.clientSecret,
      );

      expect(InitiateAuthCommand).toHaveBeenCalledWith({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: refreshData.clientId,
        AuthParameters: {
          REFRESH_TOKEN: refreshData.refreshToken,
          SECRET_HASH: 'mocked-hash-value',
        },
      });
    });
  });

  describe('decodeJwtToken (private method)', () => {
    it('should decode JWT token correctly', () => {
      const mockToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

      const decodedToken = service['decodeJwtToken'](mockToken);

      expect(decodedToken).toEqual({
        sub: '1234567890',
        name: 'John Doe',
        iat: 1516239022,
      });
    });

    it('should throw error for invalid token format', () => {
      const invalidToken = 'invalid.token';

      expect(() => {
        service['decodeJwtToken'](invalidToken);
      }).toThrow('Invalid token format');
    });

    it('should handle malformed base64 in token', () => {
      const malformedToken = 'header.invalid-base64.signature';

      expect(() => {
        service['decodeJwtToken'](malformedToken);
      }).toThrow('Invalid token format');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle very long usernames', async () => {
      const longUsername = 'a'.repeat(1000) + '@example.com';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({
          message: 'Username too long',
        }),
      });

      await expect(
        service.loginWithCustomPassword(longUsername, 'password123'),
      ).rejects.toThrow(HttpException);
    });

    it('should handle concurrent operations', async () => {
      const operations = Array.from({ length: 5 }, (_, i) => ({
        username: `user${i}@example.com`,
        password: `Password${i}!`,
      }));

      const mockResponses = operations.map((_, i) => ({
        ok: true,
        json: jest.fn().mockResolvedValue({
          AuthenticationResult: {
            ...mockAuthResult.AuthenticationResult,
            AccessToken: `token-${i}`,
          },
        }),
      }));

      (global.fetch as jest.Mock).mockImplementation((url, options) => {
        const body = JSON.parse(options.body);
        const index = operations.findIndex(
          (op) => op.username === body.AuthParameters.USERNAME,
        );
        return Promise.resolve(mockResponses[index]);
      });

      const results = await Promise.all(
        operations.map((op) =>
          service.loginWithCustomPassword(op.username, op.password),
        ),
      );

      expect(results).toHaveLength(5);
      results.forEach((result, i) => {
        expect(result.AuthenticationResult.AccessToken).toBe(`token-${i}`);
      });
    });

    it('should handle special characters in passwords', async () => {
      const specialPassword = 'P@$w0rd!#$%^&*()';

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockAuthResult),
      });

      const result = await service.loginWithCustomPassword(
        'test@example.com',
        specialPassword,
      );

      expect(result).toEqual(mockAuthResult);
    });

    it('should handle network connection timeouts', async () => {
      (global.fetch as jest.Mock).mockRejectedValue({
        code: 'ETIMEDOUT',
        message: 'Request timeout',
      });

      await expect(
        service.loginWithCustomPassword('test@example.com', 'password123'),
      ).rejects.toThrow(HttpException);
    });

    it('should handle AWS SDK errors gracefully', async () => {
      const awsError = new Error('AWS Service Unavailable');
      awsError.name = 'ServiceUnavailableException';

      cognitoClient.send.mockRejectedValue(awsError);

      await expect(
        service.createUser(
          'test@example.com',
          'TempPass123!',
          'Test',
          'User',
          'test@example.com',
        ),
      ).rejects.toThrow(
        new HttpException('AWS Service Unavailable', HttpStatus.BAD_REQUEST),
      );
    });

    it('should handle malformed configuration values', async () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'COGNITO_USER_POOL_ID') return undefined;
        return mockConfig[key];
      });

      cognitoClient.send.mockResolvedValue(mockUserResponse);

      await service.createUser(
        'test@example.com',
        'TempPass123!',
        'Test',
        'User',
        'test@example.com',
      );

      expect(AdminCreateUserCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          UserPoolId: undefined,
        }),
      );
    });

    it('should handle empty or null parameters gracefully', async () => {
      cognitoClient.send.mockResolvedValue(mockUserResponse);

      await expect(
        service.createUser('', '', '', '', ''),
      ).resolves.toBeDefined();

      expect(AdminCreateUserCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Username: '',
          UserAttributes: expect.arrayContaining([
            { Name: 'email', Value: '' },
            { Name: 'given_name', Value: '' },
            { Name: 'family_name', Value: '' },
          ]),
        }),
      );
    });
  });

  describe('Security and Validation', () => {
    it('should handle potential XSS in user attributes', async () => {
      const maliciousData = {
        username: '<script>alert("xss")</script>@example.com',
        firstName: '<script>alert("xss")</script>',
        lastName: '"><script>alert("xss")</script>',
        email: 'test@example.com<script>alert("xss")</script>',
      };

      cognitoClient.send.mockResolvedValue(mockUserResponse);

      await service.createUser(
        maliciousData.username,
        'TempPass123!',
        maliciousData.firstName,
        maliciousData.lastName,
        maliciousData.email,
      );

      expect(AdminCreateUserCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Username: maliciousData.username,
          UserAttributes: expect.arrayContaining([
            { Name: 'given_name', Value: maliciousData.firstName },
            { Name: 'family_name', Value: maliciousData.lastName },
            { Name: 'email', Value: maliciousData.email },
          ]),
        }),
      );
    });

    it('should handle SQL injection patterns in usernames', async () => {
      const maliciousUsername = "'; DROP TABLE users; --";

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({
          message: 'Invalid username format',
        }),
      });

      await expect(
        service.loginWithCustomPassword(maliciousUsername, 'Password123!'),
      ).rejects.toThrow(HttpException);
    });

    it('should handle very long attribute values', async () => {
      const longValue = 'a'.repeat(10000);
      const updateUserDto: UpdateUserDto = {
        username: 'user@example.com',
        firstName: longValue,
      };

      const attributeTooLongError = new Error('Attribute value too long');
      attributeTooLongError.name = 'InvalidParameterException';

      cognitoClient.send.mockRejectedValue(attributeTooLongError);

      await expect(service.updateUser(updateUserDto)).rejects.toThrow(
        new HttpException('Attribute value too long', HttpStatus.BAD_REQUEST),
      );
    });
  });

  describe('Token Handling Edge Cases', () => {
    it('should handle tokens with unusual characters', async () => {
      const unusualToken =
        'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkrDtMOpIG1hcsOtYSIsImFkbWluIjp0cnVlfQ.validation';

      cognitoClient.send.mockResolvedValue(mockGetUserResponse);

      await expect(
        service.validateAccessToken(unusualToken),
      ).resolves.toBeDefined();
    });

    it('should handle tokens with missing segments', async () => {
      const incompleteToken = 'header.payload';

      await expect(
        service.validateAccessToken(incompleteToken),
      ).rejects.toThrow();
    });

    it('should handle tokens with extra segments', async () => {
      const extraSegmentToken = 'header.payload.signature.extra';

      cognitoClient.send.mockResolvedValue(mockGetUserResponse);

      await expect(
        service.validateAccessToken(extraSegmentToken),
      ).rejects.toThrow(
        new HttpException('Invalid token format', HttpStatus.UNAUTHORIZED),
      );
    });
  });

  describe('Performance and Memory', () => {
    it('should handle large user attribute objects', async () => {
      const largeUserAttributes = Array.from({ length: 100 }, (_, i) => ({
        Name: `custom_attribute_${i}`,
        Value: `value_${i}`.repeat(100),
      }));

      const largeGetUserResponse = {
        ...mockGetUserResponse,
        UserAttributes: [
          ...mockGetUserResponse.UserAttributes,
          ...largeUserAttributes,
        ],
      };

      cognitoClient.send.mockResolvedValue(largeGetUserResponse);

      const mockToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE2NDc4OTEyMzQsInRva2VuX3VzZSI6ImFjY2VzcyIsImNsaWVudF9pZCI6InRlc3QtY2xpZW50LWlkIn0.signature';

      const result = await service.validateAccessToken(mockToken);

      expect(result.userAttributes).toHaveLength(
        mockGetUserResponse.UserAttributes.length + largeUserAttributes.length,
      );
    });

    it('should handle multiple simultaneous token validations', async () => {
      const tokens = Array.from(
        { length: 10 },
        (_, i) =>
          `token-${i}-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE2NDc4OTEyMzQsInRva2VuX3VzZSI6ImFjY2VzcyIsImNsaWVudF9pZCI6InRlc3QtY2xpZW50LWlkIn0.signature`,
      );

      cognitoClient.send.mockImplementation(() =>
        Promise.resolve({
          ...mockGetUserResponse,
          Username: `user-${Math.random()}`,
        }),
      );

      const results = await Promise.all(
        tokens.map((token) => service.validateAccessToken(token)),
      );

      expect(results).toHaveLength(10);
      expect(cognitoClient.send).toHaveBeenCalledTimes(10);
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should work with different AWS regions', async () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'AWS_REGION') return 'eu-west-1';
        return mockConfig[key];
      });

      const newService = new CognitoService(configService);

      expect(CognitoIdentityProviderClient).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'eu-west-1',
        }),
      );
    });

    it('should handle missing AWS credentials gracefully', async () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'AWS_ACCESS_KEY_ID' || key === 'AWS_SECRET_ACCESS_KEY') {
          return undefined;
        }
        return mockConfig[key];
      });

      const newService = new CognitoService(configService);

      expect(CognitoIdentityProviderClient).toHaveBeenCalledWith(
        expect.objectContaining({
          credentials: {
            accessKeyId: undefined,
            secretAccessKey: undefined,
          },
        }),
      );
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle password change flow end-to-end', async () => {
      cognitoClient.send.mockResolvedValueOnce(mockAuthResult);

      cognitoClient.send.mockResolvedValueOnce({});

      await service.changeUserPassword(
        'user@example.com',
        'oldPassword',
        'newStrongPassword123!',
        'client-id',
        'client-secret',
      );

      expect(cognitoClient.send).toHaveBeenCalledTimes(2);

      expect(InitiateAuthCommand).toHaveBeenCalledWith({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: 'client-id',
        AuthParameters: {
          USERNAME: 'user@example.com',
          PASSWORD: 'oldPassword',
          SECRET_HASH: 'mocked-hash-value',
        },
      });

      expect(ChangePasswordCommand).toHaveBeenCalledWith({
        AccessToken: mockAuthResult.AuthenticationResult.AccessToken,
        PreviousPassword: 'oldPassword',
        ProposedPassword: 'newStrongPassword123!',
      });
    });

    it('should handle user registration with all attributes', async () => {
      cognitoClient.send.mockResolvedValue(mockUserResponse);

      const result = await service.createUser(
        'newuser@cgiar.org',
        'TemporaryPass123!',
        'María José',
        'García-López',
        'maria.garcia@cgiar.org',
      );

      expect(result).toEqual({
        userSub: mockUserResponse.User.Username,
        enabled: mockUserResponse.User.Enabled,
        userStatus: mockUserResponse.User.UserStatus,
      });

      expect(AdminCreateUserCommand).toHaveBeenCalledWith({
        UserPoolId: mockConfig.COGNITO_USER_POOL_ID,
        Username: 'newuser@cgiar.org',
        TemporaryPassword: 'TemporaryPass123!',
        UserAttributes: [
          { Name: 'email', Value: 'maria.garcia@cgiar.org' },
          { Name: 'given_name', Value: 'María José' },
          { Name: 'family_name', Value: 'García-López' },
          { Name: 'email_verified', Value: 'true' },
        ],
      });
    });

    it('should handle token refresh with partial response', async () => {
      const partialRefreshResponse = {
        AuthenticationResult: {
          AccessToken: 'new-access-token',
          IdToken: 'new-id-token',

          ExpiresIn: 3600,
          TokenType: 'Bearer',
        },
      };

      cognitoClient.send.mockResolvedValue(partialRefreshResponse);

      const result = await service.refreshAccessToken(
        'existing-refresh-token',
        'test-client-id',
        'test-client-secret',
      );

      expect(result).toEqual({
        accessToken: 'new-access-token',
        idToken: 'new-id-token',
        refreshToken: undefined,
        expiresIn: 3600,
        tokenType: 'Bearer',
      });
    });
  });
});
