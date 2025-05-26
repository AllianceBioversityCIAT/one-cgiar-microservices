import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { RequestWithCustomAttrs } from '../../middleware/jwt-clarisa.middleware';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CustomAuthDto } from './dto/custom-auth.dto';
import { ProviderAuthDto, AuthProvider } from './dto/provider-auth.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ValidateCodeDto } from './dto/validate-code.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockRequest: Partial<RequestWithCustomAttrs> = {
    senderMisMetadata: {
      id: 1,
      name: 'Test MIS',
      acronym: 'TEST',
      main_contact_point_id: 1,
      environment_id: 1,
      mis_auth: {
        id: 1,
        mis_id: 1,
        auth_url: 'https://test.example.com/callback',
        cognito_client_id: 'test-client-id',
        cognito_client_secret: 'test-client-secret',
      },
    },
    senderId: 1,
    application: {
      id: 2,
      name: 'Auth Microservice',
      acronym: 'AUTH',
      environment: 'development',
    },
  };

  const mockAuthUrl = {
    authUrl:
      'https://cognito.amazonaws.com/oauth2/authorize?response_type=code&client_id=test-client-id&redirect_uri=https://test.example.com/callback&scope=openid+email+profile&identity_provider=CGIAR-AzureAD',
  };

  const mockTokenResponse = {
    accessToken: 'mock-access-token',
    idToken: 'mock-id-token',
    refreshToken: 'mock-refresh-token',
    expiresIn: 3600,
    tokenType: 'Bearer',
    userInfo: {
      sub: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
    },
  };

  const mockUserInfo = {
    sub: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    given_name: 'Test',
    family_name: 'User',
  };

  const mockAuthResult = {
    tokens: {
      accessToken: 'mock-access-token',
      idToken: 'mock-id-token',
      refreshToken: 'mock-refresh-token',
      expiresIn: 3600,
      tokenType: 'Bearer',
    },
  };

  const mockValidationResult = {
    valid: true,
    userInfo: mockUserInfo,
    expiresAt: 1647891234,
    tokenUse: 'access',
    clientId: 'test-client-id',
  };

  beforeEach(async () => {
    const mockAuthService = {
      authenticateWithProvider: jest.fn(),
      validateAuthorizationCode: jest.fn(),
      getUserInfo: jest.fn(),
      authenticateWithCustomPassword: jest.fn(),
      registerUser: jest.fn(),
      updateUser: jest.fn(),
      changePassword: jest.fn(),
      validateToken: jest.fn(),
      refreshAuthenticationTokens: jest.fn(),
    };

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
    authService = module.get(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('loginWithProvider', () => {
    it('should return auth URL for valid provider', async () => {
      const providerAuthDto: ProviderAuthDto = {
        provider: AuthProvider.AZURE,
      };

      authService.authenticateWithProvider.mockResolvedValue(mockAuthUrl);

      const result = await controller.loginWithProvider(
        providerAuthDto,
        mockRequest as RequestWithCustomAttrs,
      );

      expect(result).toEqual(mockAuthUrl);
      expect(authService.authenticateWithProvider).toHaveBeenCalledWith(
        providerAuthDto,
        mockRequest,
      );
    });

    it('should throw error when MIS metadata is missing', async () => {
      const providerAuthDto: ProviderAuthDto = {
        provider: AuthProvider.AZURE,
      };

      const requestWithoutMis = {
        ...mockRequest,
        senderMisMetadata: undefined,
      };

      authService.authenticateWithProvider.mockRejectedValue(
        new HttpException(
          'MIS authentication information not found',
          HttpStatus.BAD_REQUEST,
        ),
      );

      await expect(
        controller.loginWithProvider(
          providerAuthDto,
          requestWithoutMis as RequestWithCustomAttrs,
        ),
      ).rejects.toThrow(HttpException);

      expect(authService.authenticateWithProvider).toHaveBeenCalledWith(
        providerAuthDto,
        requestWithoutMis,
      );
    });

    it('should handle service errors', async () => {
      const providerAuthDto: ProviderAuthDto = {
        provider: AuthProvider.AZURE,
      };

      authService.authenticateWithProvider.mockRejectedValue(
        new HttpException(
          'Authentication URL generation failed',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );

      await expect(
        controller.loginWithProvider(
          providerAuthDto,
          mockRequest as RequestWithCustomAttrs,
        ),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('validateAuthorizationCode', () => {
    it('should return tokens and user info for valid code', async () => {
      const validateCodeDto: ValidateCodeDto = {
        code: 'valid-auth-code',
      };

      authService.validateAuthorizationCode.mockResolvedValue(
        mockTokenResponse,
      );

      const result = await controller.validateAuthorizationCode(
        validateCodeDto,
        mockRequest as RequestWithCustomAttrs,
      );

      expect(result).toEqual(mockTokenResponse);
      expect(authService.validateAuthorizationCode).toHaveBeenCalledWith(
        validateCodeDto,
        mockRequest,
      );
    });

    it('should throw error for invalid authorization code', async () => {
      const validateCodeDto: ValidateCodeDto = {
        code: 'invalid-code',
      };

      authService.validateAuthorizationCode.mockRejectedValue(
        new HttpException('Authentication failed', HttpStatus.UNAUTHORIZED),
      );

      await expect(
        controller.validateAuthorizationCode(
          validateCodeDto,
          mockRequest as RequestWithCustomAttrs,
        ),
      ).rejects.toThrow(HttpException);
    });

    it('should handle missing MIS metadata', async () => {
      const validateCodeDto: ValidateCodeDto = {
        code: 'auth-code',
      };

      const requestWithoutMis = {
        ...mockRequest,
        senderMisMetadata: undefined,
      };

      authService.validateAuthorizationCode.mockRejectedValue(
        new HttpException(
          'MIS authentication information not found',
          HttpStatus.BAD_REQUEST,
        ),
      );

      await expect(
        controller.validateAuthorizationCode(
          validateCodeDto,
          requestWithoutMis as RequestWithCustomAttrs,
        ),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('getUserInfo', () => {
    it('should return user information for valid access token', async () => {
      const body = { accessToken: 'valid-access-token' };

      authService.getUserInfo.mockResolvedValue(mockUserInfo);

      const result = await controller.getUserInfo(body);

      expect(result).toEqual(mockUserInfo);
      expect(authService.getUserInfo).toHaveBeenCalledWith(body.accessToken);
    });

    it('should throw error for invalid access token', async () => {
      const body = { accessToken: 'invalid-token' };

      authService.getUserInfo.mockRejectedValue(
        new HttpException(
          'Error retrieving user information',
          HttpStatus.UNAUTHORIZED,
        ),
      );

      await expect(controller.getUserInfo(body)).rejects.toThrow(HttpException);
    });
  });

  describe('loginWithCustomPassword', () => {
    it('should authenticate user with valid credentials', async () => {
      const customAuthDto: CustomAuthDto = {
        username: 'test@example.com',
        password: 'Password123!',
      };

      authService.authenticateWithCustomPassword.mockResolvedValue(
        mockAuthResult,
      );

      const result = await controller.loginWithCustomPassword(customAuthDto);

      expect(result).toEqual(mockAuthResult);
      expect(authService.authenticateWithCustomPassword).toHaveBeenCalledWith(
        customAuthDto,
      );
    });

    it('should throw error for invalid credentials', async () => {
      const customAuthDto: CustomAuthDto = {
        username: 'test@example.com',
        password: 'wrongpassword',
      };

      authService.authenticateWithCustomPassword.mockRejectedValue(
        new HttpException('Authentication failed', HttpStatus.UNAUTHORIZED),
      );

      await expect(
        controller.loginWithCustomPassword(customAuthDto),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('registerUser', () => {
    it('should register new user successfully', async () => {
      const registerUserDto: RegisterUserDto = {
        username: 'newuser@example.com',
        temporaryPassword: 'TempPass123!',
        firstName: 'New',
        lastName: 'User',
        email: 'newuser@example.com',
        sendEmail: false,
      };

      const mockRegisterResponse = {
        message: 'User registered successfully',
        userSub: 'new-user-123',
        temporaryPassword: true,
      };

      authService.registerUser.mockResolvedValue(mockRegisterResponse);

      const result = await controller.registerUser(
        registerUserDto,
        mockRequest as RequestWithCustomAttrs,
      );

      expect(result).toEqual(mockRegisterResponse);
      expect(authService.registerUser).toHaveBeenCalledWith(
        registerUserDto,
        mockRequest,
      );
    });

    it('should throw error when user already exists', async () => {
      const registerUserDto: RegisterUserDto = {
        username: 'existing@example.com',
        temporaryPassword: 'TempPass123!',
        firstName: 'Existing',
        lastName: 'User',
        email: 'existing@example.com',
        sendEmail: false,
      };

      authService.registerUser.mockRejectedValue(
        new HttpException('User already exists', HttpStatus.BAD_REQUEST),
      );

      await expect(
        controller.registerUser(
          registerUserDto,
          mockRequest as RequestWithCustomAttrs,
        ),
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

      const mockUpdateResponse = {
        message: 'User updated successfully',
        username: 'user@example.com',
      };

      authService.updateUser.mockResolvedValue(mockUpdateResponse);

      const result = await controller.updateUser(
        updateUserDto,
        mockRequest as RequestWithCustomAttrs,
      );

      expect(result).toEqual(mockUpdateResponse);
      expect(authService.updateUser).toHaveBeenCalledWith(
        updateUserDto,
        mockRequest,
      );
    });

    it('should throw error when user not found', async () => {
      const updateUserDto: UpdateUserDto = {
        username: 'nonexistent@example.com',
        firstName: 'Updated',
        lastName: 'Name',
      };

      authService.updateUser.mockRejectedValue(
        new HttpException('User not found', HttpStatus.BAD_REQUEST),
      );

      await expect(
        controller.updateUser(
          updateUserDto,
          mockRequest as RequestWithCustomAttrs,
        ),
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

      const mockChangePasswordResponse = {
        message: 'Password changed successfully',
        username: 'user@example.com',
      };

      authService.changePassword.mockResolvedValue(mockChangePasswordResponse);

      const result = await controller.changePassword(
        changePasswordDto,
        mockRequest as RequestWithCustomAttrs,
      );

      expect(result).toEqual(mockChangePasswordResponse);
      expect(authService.changePassword).toHaveBeenCalledWith(
        changePasswordDto,
        mockRequest,
      );
    });

    it('should throw error for incorrect current password', async () => {
      const changePasswordDto: ChangePasswordDto = {
        username: 'user@example.com',
        currentPassword: 'WrongPass123!',
        newPassword: 'NewPass123!',
      };

      authService.changePassword.mockRejectedValue(
        new HttpException(
          'Current password is incorrect',
          HttpStatus.UNAUTHORIZED,
        ),
      );

      await expect(
        controller.changePassword(
          changePasswordDto,
          mockRequest as RequestWithCustomAttrs,
        ),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('validateToken', () => {
    it('should validate token successfully', async () => {
      const body = { accessToken: 'valid-access-token' };

      authService.validateToken.mockResolvedValue(mockValidationResult);

      const result = await controller.validateToken(body);

      expect(result).toEqual(mockValidationResult);
      expect(authService.validateToken).toHaveBeenCalledWith(body.accessToken);
    });

    it('should return invalid result for expired token', async () => {
      const body = { accessToken: 'expired-token' };

      const mockExpiredTokenResult = {
        valid: false,
        error: 'Token expired or invalid',
        code: 'TOKEN_EXPIRED',
      };

      authService.validateToken.mockResolvedValue(mockExpiredTokenResult);

      const result = await controller.validateToken(body);

      expect(result).toEqual(mockExpiredTokenResult);
      expect(result.valid).toBe(false);
    });

    it('should throw error for malformed token', async () => {
      const body = { accessToken: 'malformed-token' };

      authService.validateToken.mockRejectedValue(
        new HttpException('Token validation failed', HttpStatus.UNAUTHORIZED),
      );

      await expect(controller.validateToken(body)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('refreshToken', () => {
    it('should refresh tokens successfully', async () => {
      const body = { refreshToken: 'valid-refresh-token' };

      const mockRefreshResponse = {
        ...mockTokenResponse,
        refreshToken: 'new-refresh-token',
      };

      authService.refreshAuthenticationTokens.mockResolvedValue(
        mockRefreshResponse,
      );

      const result = await controller.refreshToken(
        body,
        mockRequest as RequestWithCustomAttrs,
      );

      expect(result).toEqual(mockRefreshResponse);
      expect(authService.refreshAuthenticationTokens).toHaveBeenCalledWith(
        body.refreshToken,
        mockRequest,
      );
    });

    it('should throw error for expired refresh token', async () => {
      const body = { refreshToken: 'expired-refresh-token' };

      authService.refreshAuthenticationTokens.mockRejectedValue(
        new HttpException(
          'Refresh token has expired. Please login again.',
          HttpStatus.UNAUTHORIZED,
        ),
      );

      await expect(
        controller.refreshToken(body, mockRequest as RequestWithCustomAttrs),
      ).rejects.toThrow(HttpException);
    });

    it('should throw error for invalid refresh token', async () => {
      const body = { refreshToken: 'invalid-refresh-token' };

      authService.refreshAuthenticationTokens.mockRejectedValue(
        new HttpException('Token refresh failed', HttpStatus.UNAUTHORIZED),
      );

      await expect(
        controller.refreshToken(body, mockRequest as RequestWithCustomAttrs),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected service errors gracefully', async () => {
      const providerAuthDto: ProviderAuthDto = {
        provider: AuthProvider.AZURE,
      };

      authService.authenticateWithProvider.mockRejectedValue(
        new Error('Unexpected error'),
      );

      await expect(
        controller.loginWithProvider(
          providerAuthDto,
          mockRequest as RequestWithCustomAttrs,
        ),
      ).rejects.toThrow();
    });

    it('should handle network timeouts', async () => {
      const validateCodeDto: ValidateCodeDto = {
        code: 'auth-code',
      };

      authService.validateAuthorizationCode.mockRejectedValue(
        new HttpException('Request timeout', HttpStatus.REQUEST_TIMEOUT),
      );

      await expect(
        controller.validateAuthorizationCode(
          validateCodeDto,
          mockRequest as RequestWithCustomAttrs,
        ),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('Integration with MIS Metadata', () => {
    it('should work with different MIS configurations', async () => {
      const alternativeMisRequest: Partial<RequestWithCustomAttrs> = {
        ...mockRequest,
        senderMisMetadata: {
          id: 2,
          name: 'Alternative MIS',
          acronym: 'ALT',
          main_contact_point_id: 2,
          environment_id: 2,
          mis_auth: {
            id: 2,
            mis_id: 2,
            auth_url: 'https://alt.example.com/callback',
            cognito_client_id: 'alt-client-id',
            cognito_client_secret: 'alt-client-secret',
          },
        },
      };

      const providerAuthDto: ProviderAuthDto = {
        provider: AuthProvider.AZURE,
      };

      const altMockAuthUrl = {
        authUrl:
          'https://cognito.amazonaws.com/oauth2/authorize?response_type=code&client_id=alt-client-id&redirect_uri=https://alt.example.com/callback&scope=openid+email+profile&identity_provider=CGIAR-AzureAD',
      };

      authService.authenticateWithProvider.mockResolvedValue(altMockAuthUrl);

      const result = await controller.loginWithProvider(
        providerAuthDto,
        alternativeMisRequest as RequestWithCustomAttrs,
      );

      expect(result).toEqual(altMockAuthUrl);
      expect(authService.authenticateWithProvider).toHaveBeenCalledWith(
        providerAuthDto,
        alternativeMisRequest,
      );
    });

    it('should handle MIS without authentication configuration', async () => {
      const requestWithoutAuth: Partial<RequestWithCustomAttrs> = {
        ...mockRequest,
        senderMisMetadata: {
          id: 3,
          name: 'No Auth MIS',
          acronym: 'NOAUTH',
          main_contact_point_id: 3,
          environment_id: 1,
        },
      };

      const providerAuthDto: ProviderAuthDto = {
        provider: AuthProvider.AZURE,
      };

      authService.authenticateWithProvider.mockRejectedValue(
        new HttpException(
          'MIS does not have authentication configuration',
          HttpStatus.BAD_REQUEST,
        ),
      );

      await expect(
        controller.loginWithProvider(
          providerAuthDto,
          requestWithoutAuth as RequestWithCustomAttrs,
        ),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('Input Validation', () => {
    it('should handle empty request bodies', async () => {
      const emptyBody = {};

      authService.getUserInfo.mockRejectedValue(
        new HttpException('Access token is required', HttpStatus.BAD_REQUEST),
      );

      await expect(
        controller.getUserInfo(emptyBody as { accessToken: string }),
      ).rejects.toThrow(HttpException);
    });

    it('should handle invalid email format in custom auth', async () => {
      const invalidEmailDto: CustomAuthDto = {
        username: 'not-an-email',
        password: 'Password123!',
      };

      authService.authenticateWithCustomPassword.mockRejectedValue(
        new HttpException('Invalid email format', HttpStatus.BAD_REQUEST),
      );

      await expect(
        controller.loginWithCustomPassword(invalidEmailDto),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle multiple simultaneous token validations', async () => {
      const body1 = { accessToken: 'token-1' };
      const body2 = { accessToken: 'token-2' };

      const result1 = {
        ...mockValidationResult,
        userInfo: { ...mockUserInfo, sub: 'user-1' },
      };
      const result2 = {
        ...mockValidationResult,
        userInfo: { ...mockUserInfo, sub: 'user-2' },
      };

      authService.validateToken
        .mockResolvedValueOnce(result1)
        .mockResolvedValueOnce(result2);

      const [response1, response2] = await Promise.all([
        controller.validateToken(body1),
        controller.validateToken(body2),
      ]);

      expect(response1.userInfo.sub).toBe('user-1');
      expect(response2.userInfo.sub).toBe('user-2');
      expect(authService.validateToken).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long tokens', async () => {
      const longToken = 'a'.repeat(2048); // Very long token
      const body = { accessToken: longToken };

      authService.getUserInfo.mockResolvedValue(mockUserInfo);

      const result = await controller.getUserInfo(body);

      expect(result).toEqual(mockUserInfo);
      expect(authService.getUserInfo).toHaveBeenCalledWith(longToken);
    });

    it('should handle special characters in usernames', async () => {
      const customAuthDto: CustomAuthDto = {
        username: 'user+test@example.com',
        password: 'Password123!',
      };

      authService.authenticateWithCustomPassword.mockResolvedValue(
        mockAuthResult,
      );

      const result = await controller.loginWithCustomPassword(customAuthDto);

      expect(result).toEqual(mockAuthResult);
      expect(authService.authenticateWithCustomPassword).toHaveBeenCalledWith(
        customAuthDto,
      );
    });

    it('should handle null/undefined values gracefully', async () => {
      const bodyWithNull = { accessToken: null as any };

      authService.getUserInfo.mockRejectedValue(
        new HttpException('Invalid access token', HttpStatus.BAD_REQUEST),
      );

      await expect(controller.getUserInfo(bodyWithNull)).rejects.toThrow(
        HttpException,
      );
    });
  });
});
