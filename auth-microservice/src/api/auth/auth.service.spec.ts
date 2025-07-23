import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { ProviderAuthDto } from './dto/provider-auth.dto';
import { ValidateCodeDto } from './dto/validate-code.dto';
import { CustomAuthDto } from './dto/custom-auth.dto';
import { EmailConfigDto, RegisterUserDto } from './dto/register-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { HttpException, HttpStatus } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { RequestWithCustomAttrs } from '../../middleware/jwt-clarisa.middleware';
import { CognitoService } from './services/cognito/cognito.service';
import { DynamicEmailService } from './services/dynamic-email/dynamic-email.service';
import { PasswordGeneratorService } from './services/password/password.service';

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

const mockEmailConfig: EmailConfigDto = {
  sender_email: 'noreply@test.cgiar.org',
  sender_name: 'Test Team',
  welcome_subject: 'Welcome to {{appName}}, {{firstName}}!',
  app_name: 'Test Application',
  app_url: 'https://test.cgiar.org',
  support_email: 'support@test.cgiar.org',
  logo_url: 'https://test.cgiar.org/logo.png',
  welcome_html_template:
    '<html><body><h1>Welcome {{firstName}}!</h1><p>Password: {{tempPassword}}</p></body></html>',
};

describe('AuthService', () => {
  let service: AuthService;
  let httpService: HttpService;
  let configService: ConfigService;
  let cognitoService: CognitoService;
  let dynamicEmailService: DynamicEmailService;
  let passwordGeneratorService: PasswordGeneratorService;

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
                COGNITO_CLIENT_ID: 'mock-client-id',
                COGNITO_CLIENT_SECRET: 'mock-client-secret',
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
        {
          provide: DynamicEmailService,
          useValue: {
            validateEmailConfig: jest.fn(),
            sendWelcomeEmail: jest.fn(),
            getEmailStats: jest.fn(),
          },
        },
        {
          provide: PasswordGeneratorService,
          useValue: {
            generateSecurePassword: jest.fn(),
            validateCognitoPassword: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    httpService = module.get<HttpService>(HttpService);
    configService = module.get<ConfigService>(ConfigService);
    cognitoService = module.get<CognitoService>(CognitoService);
    dynamicEmailService = module.get<DynamicEmailService>(DynamicEmailService);
    passwordGeneratorService = module.get<PasswordGeneratorService>(
      PasswordGeneratorService,
    );
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
      expect(result).toHaveProperty('accessToken', 'mock-access-token');
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

  describe('registerUser - Dynamic Email Registration', () => {
    const mockDynamicRegisterResponse = {
      message: 'User registered successfully',
      userSub: 'new-user-123',
      temporaryPassword: true,
      emailSent: true,
      emailConfig: {
        appName: 'Test Application',
        senderEmail: 'noreply@test.cgiar.org',
        templateProcessed: true,
        variablesUsed: 6,
        templateSize: 256,
      },
    };

    const mockCreateUserResult = {
      userSub: 'new-user-123',
      enabled: true,
      userStatus: 'FORCE_CHANGE_PASSWORD',
    };

    beforeEach(() => {
      // Reset mocks
      jest.clearAllMocks();
    });

    it('should register user with auto-generated password and send dynamic email', async () => {
      const registerUserDto = {
        username: 'newuser@test.cgiar.org',
        firstName: 'New',
        lastName: 'User',
        email: 'newuser@test.cgiar.org',
        emailConfig: mockEmailConfig,
      };

      // Mock validaciones y servicios
      jest.spyOn(dynamicEmailService, 'validateEmailConfig').mockReturnValue({
        isValid: true,
        errors: [],
      });
      jest
        .spyOn(passwordGeneratorService, 'generateSecurePassword')
        .mockReturnValue('TempPass123!');
      jest
        .spyOn(passwordGeneratorService, 'validateCognitoPassword')
        .mockReturnValue({
          isValid: true,
          errors: [],
        });
      jest
        .spyOn(cognitoService, 'createUser')
        .mockResolvedValue(mockCreateUserResult);
      jest
        .spyOn(dynamicEmailService, 'sendWelcomeEmail')
        .mockResolvedValue(true);
      jest.spyOn(dynamicEmailService, 'getEmailStats').mockReturnValue({
        variableCount: 6,
        variables: [
          'firstName',
          'lastName',
          'username',
          'email',
          'tempPassword',
          'appName',
        ],
        templateSize: 256,
      });

      const result = await service.registerUser(registerUserDto, mockRequest);

      expect(dynamicEmailService.validateEmailConfig).toHaveBeenCalledWith(
        mockEmailConfig,
      );
      expect(
        passwordGeneratorService.generateSecurePassword,
      ).toHaveBeenCalledWith(12, true, true);
      expect(
        passwordGeneratorService.validateCognitoPassword,
      ).toHaveBeenCalledWith('TempPass123!');
      expect(cognitoService.createUser).toHaveBeenCalledWith(
        'newuser@test.cgiar.org',
        'TempPass123!',
        'New',
        'User',
        'newuser@test.cgiar.org',
      );
      expect(dynamicEmailService.sendWelcomeEmail).toHaveBeenCalledWith(
        registerUserDto,
        'TempPass123!',
        mockEmailConfig,
      );

      expect(result).toEqual({
        message: 'User registered successfully',
        userSub: 'new-user-123',
        temporaryPassword: true,
        emailSent: true,
        emailConfig: {
          appName: 'Test Application',
          senderEmail: 'noreply@test.cgiar.org',
          templateProcessed: true,
          variablesUsed: 6,
          templateSize: 256,
        },
      });
    });

    it('should register user successfully even if email fails', async () => {
      const registerUserDto = {
        username: 'newuser@test.cgiar.org',
        firstName: 'New',
        lastName: 'User',
        email: 'newuser@test.cgiar.org',
        emailConfig: mockEmailConfig,
      };

      jest.spyOn(dynamicEmailService, 'validateEmailConfig').mockReturnValue({
        isValid: true,
        errors: [],
      });
      jest
        .spyOn(passwordGeneratorService, 'generateSecurePassword')
        .mockReturnValue('TempPass123!');
      jest
        .spyOn(passwordGeneratorService, 'validateCognitoPassword')
        .mockReturnValue({
          isValid: true,
          errors: [],
        });
      jest
        .spyOn(cognitoService, 'createUser')
        .mockResolvedValue(mockCreateUserResult);
      jest
        .spyOn(dynamicEmailService, 'sendWelcomeEmail')
        .mockRejectedValue(new Error('RabbitMQ connection failed'));
      jest.spyOn(dynamicEmailService, 'getEmailStats').mockReturnValue({
        variableCount: 6,
        variables: [
          'firstName',
          'lastName',
          'username',
          'email',
          'tempPassword',
          'appName',
        ],
        templateSize: 256,
      });

      const result = await service.registerUser(registerUserDto, mockRequest);

      expect(result.message).toBe('User registered successfully');
      expect(result.userSub).toBe('new-user-123');
      expect(result.emailSent).toBe(false);
      expect(result.emailError).toBe('RabbitMQ connection failed');
    });

    it('should throw error for invalid email configuration', async () => {
      const registerUserDto = {
        username: 'newuser@test.cgiar.org',
        firstName: 'New',
        lastName: 'User',
        email: 'newuser@test.cgiar.org',
        emailConfig: {
          ...mockEmailConfig,
          sender_email: 'invalid-email',
          welcome_html_template: 'No password variable',
        },
      };

      jest.spyOn(dynamicEmailService, 'validateEmailConfig').mockReturnValue({
        isValid: false,
        errors: [
          'sender_email debe tener formato válido',
          'welcome_html_template debe contener la variable {{tempPassword}}',
        ],
      });

      await expect(
        service.registerUser(registerUserDto, mockRequest),
      ).rejects.toThrow(
        new HttpException(
          'Email configuration is invalid: sender_email debe tener formato válido, welcome_html_template debe contener la variable {{tempPassword}}',
          HttpStatus.BAD_REQUEST,
        ),
      );

      expect(dynamicEmailService.validateEmailConfig).toHaveBeenCalledWith(
        registerUserDto.emailConfig,
      );
    });

    it('should throw error for invalid generated password', async () => {
      const registerUserDto = {
        username: 'newuser@test.cgiar.org',
        firstName: 'New',
        lastName: 'User',
        email: 'newuser@test.cgiar.org',
        emailConfig: mockEmailConfig,
      };

      jest.spyOn(dynamicEmailService, 'validateEmailConfig').mockReturnValue({
        isValid: true,
        errors: [],
      });
      jest
        .spyOn(passwordGeneratorService, 'generateSecurePassword')
        .mockReturnValue('weakpass');
      jest
        .spyOn(passwordGeneratorService, 'validateCognitoPassword')
        .mockReturnValue({
          isValid: false,
          errors: [
            'Debe contener al menos una mayúscula',
            'Debe contener al menos un símbolo especial',
          ],
        });

      await expect(
        service.registerUser(registerUserDto, mockRequest),
      ).rejects.toThrow(
        new HttpException(
          'Generated password is invalid: Debe contener al menos una mayúscula, Debe contener al menos un símbolo especial',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );

      expect(
        passwordGeneratorService.validateCognitoPassword,
      ).toHaveBeenCalledWith('weakpass');
    });

    it('should throw error when MIS metadata is missing', async () => {
      const registerUserDto = {
        username: 'newuser@test.cgiar.org',
        firstName: 'New',
        lastName: 'User',
        email: 'newuser@test.cgiar.org',
        emailConfig: mockEmailConfig,
      };

      const requestWithoutMis = createMockRequest();
      requestWithoutMis.senderMisMetadata = null;

      await expect(
        service.registerUser(registerUserDto, requestWithoutMis),
      ).rejects.toThrow(
        new HttpException(
          'MIS authentication information not found',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should handle Cognito creation failure after password generation', async () => {
      const registerUserDto = {
        username: 'existing@test.cgiar.org',
        firstName: 'Existing',
        lastName: 'User',
        email: 'existing@test.cgiar.org',
        emailConfig: mockEmailConfig,
      };

      jest.spyOn(dynamicEmailService, 'validateEmailConfig').mockReturnValue({
        isValid: true,
        errors: [],
      });
      jest
        .spyOn(passwordGeneratorService, 'generateSecurePassword')
        .mockReturnValue('TempPass123!');
      jest
        .spyOn(passwordGeneratorService, 'validateCognitoPassword')
        .mockReturnValue({
          isValid: true,
          errors: [],
        });
      jest
        .spyOn(cognitoService, 'createUser')
        .mockRejectedValue(
          new HttpException('User already exists', HttpStatus.BAD_REQUEST),
        );

      await expect(
        service.registerUser(registerUserDto, mockRequest),
      ).rejects.toThrow(
        new HttpException('User already exists', HttpStatus.BAD_REQUEST),
      );

      expect(cognitoService.createUser).toHaveBeenCalled();
    });

    it('should handle XSS validation in email template', async () => {
      const registerUserDto = {
        username: 'newuser@test.cgiar.org',
        firstName: 'New',
        lastName: 'User',
        email: 'newuser@test.cgiar.org',
        emailConfig: {
          ...mockEmailConfig,
          welcome_html_template:
            '<html><body><script>alert("xss")</script><h1>Welcome {{firstName}}!</h1></body></html>',
        },
      };

      jest.spyOn(dynamicEmailService, 'validateEmailConfig').mockReturnValue({
        isValid: false,
        errors: ['welcome_html_template no debe contener etiquetas <script>'],
      });

      await expect(
        service.registerUser(registerUserDto, mockRequest),
      ).rejects.toThrow(
        new HttpException(
          'Email configuration is invalid: welcome_html_template no debe contener etiquetas <script>',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should handle complex email configuration with all fields', async () => {
      const complexEmailConfig: EmailConfigDto = {
        sender_email: 'complex@test.cgiar.org',
        sender_name: 'Complex Test Team',
        welcome_subject: '🔐 Welcome {{firstName}} to {{appName}}!',
        app_name: 'Complex Test Application',
        app_url: 'https://complex.test.cgiar.org',
        support_email: 'support@complex.test.cgiar.org',
        logo_url: 'https://complex.test.cgiar.org/logo.png',
        welcome_html_template:
          '<html><body><img src="{{logoUrl}}"><h1>Welcome {{firstName}} {{lastName}}!</h1><p>App: {{appName}}</p><p>Password: {{tempPassword}}</p><p>Support: {{supportEmail}}</p></body></html>',
        custom_styles: '.custom { color: blue; }',
      };

      const registerUserDto = {
        username: 'complex@test.cgiar.org',
        firstName: 'Complex',
        lastName: 'User',
        email: 'complex@test.cgiar.org',
        emailConfig: complexEmailConfig,
      };

      jest.spyOn(dynamicEmailService, 'validateEmailConfig').mockReturnValue({
        isValid: true,
        errors: [],
      });
      jest
        .spyOn(passwordGeneratorService, 'generateSecurePassword')
        .mockReturnValue('ComplexPass123!');
      jest
        .spyOn(passwordGeneratorService, 'validateCognitoPassword')
        .mockReturnValue({
          isValid: true,
          errors: [],
        });
      jest
        .spyOn(cognitoService, 'createUser')
        .mockResolvedValue(mockCreateUserResult);
      jest
        .spyOn(dynamicEmailService, 'sendWelcomeEmail')
        .mockResolvedValue(true);
      jest.spyOn(dynamicEmailService, 'getEmailStats').mockReturnValue({
        variableCount: 8,
        variables: [
          'firstName',
          'lastName',
          'logoUrl',
          'appName',
          'tempPassword',
          'supportEmail',
        ],
        templateSize: 512,
      });

      const result = await service.registerUser(registerUserDto, mockRequest);

      expect(result.emailConfig.variablesUsed).toBe(8);
      expect(result.emailConfig.templateSize).toBe(512);
      expect(dynamicEmailService.sendWelcomeEmail).toHaveBeenCalledWith(
        registerUserDto,
        'ComplexPass123!',
        complexEmailConfig,
      );
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
});
