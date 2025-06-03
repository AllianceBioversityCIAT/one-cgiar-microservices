import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { BulkUserService } from './bulk-registration.service';
import { EmailNotificationManagementService } from '../notification/notification.service';
import { PasswordGeneratorService } from '../password/password.service';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  BulkCreateUsersDto,
  CreateUserDto,
  UserCreationResult,
  BulkCreationResponse,
} from '../../dto/bulk-user-registration.dto';

// Mock AWS SDK
jest.mock('@aws-sdk/client-cognito-identity-provider');

describe('BulkUserService', () => {
  let service: BulkUserService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockEmailService: jest.Mocked<EmailNotificationManagementService>;
  let mockPasswordGenerator: jest.Mocked<PasswordGeneratorService>;
  let mockCognitoClient: jest.Mocked<CognitoIdentityProviderClient>;
  let loggerSpy: jest.SpyInstance;

  const mockConfig = {
    AWS_REGION: 'us-east-1',
    AWS_ACCESS_KEY_ID: 'test-access-key',
    AWS_SECRET_ACCESS_KEY: 'test-secret-key',
    COGNITO_USER_POOL_ID: 'us-east-1_testpool',
    EMAIL_SENDER: 'test@example.com',
    TECH_SUPPORT_EMAIL: 'support@example.com',
  };

  const mockUser: CreateUserDto = {
    email: 'test@example.com',
    username: 'testuser',
    firstName: 'John',
    lastName: 'Doe',
  };

  const mockBulkUsersDto: BulkCreateUsersDto = {
    users: [mockUser],
  };

  beforeEach(async () => {
    // Create mocks
    mockConfigService = {
      get: jest.fn(),
    } as any;

    mockEmailService = {
      sendEmail: jest.fn(),
    } as any;

    mockPasswordGenerator = {
      generateSecurePassword: jest.fn(),
      validateCognitoPassword: jest.fn(),
    } as any;

    mockCognitoClient = {
      send: jest.fn(),
    } as any;

    // Setup config service mock
    mockConfigService.get.mockImplementation((key: string) => mockConfig[key]);

    // Setup password generator mocks
    mockPasswordGenerator.generateSecurePassword.mockReturnValue(
      'TempPass123!',
    );
    mockPasswordGenerator.validateCognitoPassword.mockReturnValue({
      isValid: true,
      errors: [],
    });

    // Mock CognitoIdentityProviderClient constructor
    (
      CognitoIdentityProviderClient as jest.MockedClass<
        typeof CognitoIdentityProviderClient
      >
    ).mockImplementation(() => mockCognitoClient);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BulkUserService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: EmailNotificationManagementService,
          useValue: mockEmailService,
        },
        {
          provide: PasswordGeneratorService,
          useValue: mockPasswordGenerator,
        },
      ],
    }).compile();

    service = module.get<BulkUserService>(BulkUserService);

    // Spy on logger methods
    loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    // Mock sleep to speed up tests
    jest.spyOn(service as any, 'sleep').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize Cognito client with correct configuration', () => {
      expect(CognitoIdentityProviderClient).toHaveBeenCalledWith({
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
        },
      });
    });

    it('should set userPoolId from config', () => {
      expect(mockConfigService.get).toHaveBeenCalledWith(
        'COGNITO_USER_POOL_ID',
      );
      const userPoolId = (service as any).userPoolId;
      expect(userPoolId).toBe('us-east-1_testpool');
    });
  });

  describe('bulkCreateUsers', () => {
    it('should handle empty users array', async () => {
      const emptyDto: BulkCreateUsersDto = { users: [] };

      const result = await service.bulkCreateUsers(emptyDto);

      expect(result).toEqual({
        totalUsers: 0,
        successCount: 0,
        failedCount: 0,
        emailsSent: 0,
        emailsFailed: 0,
        results: [],
      });
    });
  });

  describe('createSingleUser (private method)', () => {
    it('should handle invalid generated password', async () => {
      mockPasswordGenerator.validateCognitoPassword.mockReturnValue({
        isValid: false,
        errors: ['Password too weak'],
      });

      const result = await (service as any).createSingleUser(mockUser);

      expect(result.success).toBe(false);
      expect(result.error).toContain(
        'Generated password is not valid: Password too weak',
      );
      expect(mockCognitoClient.send).not.toHaveBeenCalled();
    });
  });

  describe('sendWelcomeEmail (private method)', () => {
    it('should send email successfully', async () => {
      mockEmailService.sendEmail.mockImplementation(() => {});

      const result = await (service as any).sendWelcomeEmail(
        mockUser,
        'TempPass123!',
      );

      expect(result).toBe(true);
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith({
        from: {
          email: 'test@example.com',
          name: 'PRMS Reporting Tool',
        },
        emailBody: {
          subject:
            '🔐 Important: PRMS Account Security Update - Action Required',
          to: 'test@example.com',
          cc: '',
          bcc: 'support@example.com',
          message: {
            text: 'PRMS Account Migration - Temporary Password for John',
            socketFile: expect.any(Buffer),
          },
        },
      });

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        '✅ Email sent for: test@example.com',
      );
    });

    it('should handle email sending errors', async () => {
      mockEmailService.sendEmail.mockImplementation(() => {
        throw new Error('SMTP connection failed');
      });

      const result = await (service as any).sendWelcomeEmail(
        mockUser,
        'TempPass123!',
      );

      expect(result).toBe(false);
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        '❌ Error sending email for test@example.com: SMTP connection failed',
      );
    });

    it('should use default support email when config is empty', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'TECH_SUPPORT_EMAIL') return '';
        return mockConfig[key];
      });

      await (service as any).sendWelcomeEmail(mockUser, 'TempPass123!');

      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          emailBody: expect.objectContaining({
            bcc: '',
          }),
        }),
      );
    });
  });

  describe('generateWelcomeEmailHTML (private method)', () => {
    it('should generate HTML with user data', () => {
      const html = (service as any).generateWelcomeEmailHTML(
        mockUser,
        'TempPass123!',
      );

      expect(html).toContain('Dear John,');
      expect(html).toContain('test@example.com');
      expect(html).toContain('TempPass123!');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('</html>');
    });

    it('should escape special characters in user data', () => {
      const userWithSpecialChars: CreateUserDto = {
        email: 'test+user@example.com',
        username: 'test<user>',
        firstName: 'John "Johnny"',
        lastName: "O'Connor",
      };

      const html = (service as any).generateWelcomeEmailHTML(
        userWithSpecialChars,
        'Pass<123>!',
      );

      expect(html).toContain('John "Johnny"');
      expect(html).toContain('test+user@example.com');
      expect(html).toContain('Pass<123>!');
    });

    it('should generate valid HTML structure', () => {
      const html = (service as any).generateWelcomeEmailHTML(
        mockUser,
        'TempPass123!',
      );

      // Check for essential HTML structure
      expect(html).toMatch(/<html[^>]*>/);
      expect(html).toMatch(/<head[^>]*>/);
      expect(html).toMatch(/<body[^>]*>/);
      expect(html).toMatch(/<\/html>/);
      expect(html).toMatch(/<\/head>/);
      expect(html).toMatch(/<\/body>/);
    });
  });

  describe('logFinalReport (private method)', () => {
    it('should log final report with correct statistics', () => {
      const mockResponse: BulkCreationResponse = {
        totalUsers: 5,
        successCount: 3,
        failedCount: 2,
        emailsSent: 3,
        emailsFailed: 0,
        results: [],
      };

      (service as any).logFinalReport(mockResponse);

      expect(Logger.prototype.log).toHaveBeenCalledWith('='.repeat(60));
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        '📊 REPORTE FINAL DE CREACIÓN MASIVA',
      );
      expect(Logger.prototype.log).toHaveBeenCalledWith('📈 Total usuarios: 5');
      expect(Logger.prototype.log).toHaveBeenCalledWith('✅ Exitosos: 3');
      expect(Logger.prototype.log).toHaveBeenCalledWith('❌ Fallidos: 2');
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        '📧 Emails enviados: 3',
      );
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        '📧 Emails fallidos: 0',
      );
    });
  });

  describe('sleep (private method)', () => {
    beforeEach(() => {
      // Restore the original sleep method for these tests
      jest.restoreAllMocks();
    });

    it('should resolve after specified milliseconds', async () => {
      const startTime = Date.now();
      await (service as any).sleep(100);
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(90); // Allow some tolerance
    });

    it('should handle zero milliseconds', async () => {
      const startTime = Date.now();
      await (service as any).sleep(0);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(50); // Should be very quick
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle Cognito client initialization failure', () => {
      (
        CognitoIdentityProviderClient as jest.MockedClass<
          typeof CognitoIdentityProviderClient
        >
      ).mockImplementation(() => {
        throw new Error('AWS configuration error');
      });

      expect(() => {
        new BulkUserService(
          mockConfigService,
          mockEmailService,
          mockPasswordGenerator,
        );
      }).toThrow('AWS configuration error');
    });

    it('should handle missing configuration values', () => {
      mockConfigService.get.mockImplementation(() => undefined);

      const newService = new BulkUserService(
        mockConfigService,
        mockEmailService,
        mockPasswordGenerator,
      );

      expect(newService).toBeDefined();
      expect((newService as any).userPoolId).toBeUndefined();
    });

    it('should handle password generation failure', async () => {
      mockPasswordGenerator.generateSecurePassword.mockImplementation(() => {
        throw new Error('Random number generation failed');
      });

      const result = await (service as any).createSingleUser(mockUser);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Random number generation failed');
    });
  });
});
