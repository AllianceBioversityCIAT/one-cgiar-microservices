import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';
import { EmailNotificationManagementService } from './notification.service';

describe('EmailNotificationManagementService', () => {
  let service: EmailNotificationManagementService;
  let mockClientProxy: jest.Mocked<ClientProxy>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let loggerSpy: jest.SpyInstance;

  const mockConfig = {
    MS_NOTIFICATION_USER: 'test-user-123',
    MS_NOTIFICATION_PASSWORD: 'test-password-456',
  };

  beforeEach(async () => {
    mockClientProxy = {
      connect: jest.fn(),
      emit: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
    } as any;

    mockConfigService = {
      get: jest.fn(),
    } as any;

    mockConfigService.get.mockImplementation((key: string) => {
      return mockConfig[key];
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailNotificationManagementService,
        {
          provide: 'EMAIL_SERVICE',
          useValue: mockClientProxy,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<EmailNotificationManagementService>(
      EmailNotificationManagementService,
    );

    loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with correct auth headers from config', () => {
      expect(mockConfigService.get).toHaveBeenCalledWith(
        'MS_NOTIFICATION_USER',
      );
      expect(mockConfigService.get).toHaveBeenCalledWith(
        'MS_NOTIFICATION_PASSWORD',
      );

      const authHeader = (service as any).authHeaderMs;
      expect(authHeader).toEqual({
        username: 'test-user-123',
        password: 'test-password-456',
      });
    });

    it('should handle missing config values gracefully', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'MS_NOTIFICATION_USER') return undefined;
        if (key === 'MS_NOTIFICATION_PASSWORD') return undefined;
        return null;
      });

      const serviceWithMissingConfig = new EmailNotificationManagementService(
        mockClientProxy,
        mockConfigService,
      );

      const authHeader = (serviceWithMissingConfig as any).authHeaderMs;
      expect(authHeader).toEqual({
        username: undefined,
        password: undefined,
      });
    });
  });

  describe('onModuleInit', () => {
    it('should successfully connect to RabbitMQ and log success', async () => {
      mockClientProxy.connect.mockResolvedValue(undefined);

      await service.onModuleInit();

      expect(mockClientProxy.connect).toHaveBeenCalledTimes(1);
      expect(loggerSpy).toHaveBeenCalledWith(
        'Successfully connected to RabbitMQ Email MicroService',
      );
    });

    it('should handle connection failure and log error', async () => {
      const errorMessage = 'Connection failed';
      const connectionError = new Error(errorMessage);
      mockClientProxy.connect.mockRejectedValue(connectionError);

      const errorSpy = jest.spyOn(Logger.prototype, 'error');

      await service.onModuleInit();

      expect(mockClientProxy.connect).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to connect to RabbitMQ Email MicroService',
        errorMessage,
      );
    });

    it('should handle connection failure without error message', async () => {
      const connectionError = new Error();
      connectionError.message = undefined as any;
      mockClientProxy.connect.mockRejectedValue(connectionError);

      const errorSpy = jest.spyOn(Logger.prototype, 'error');

      await service.onModuleInit();

      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to connect to RabbitMQ Email MicroService',
        undefined,
      );
    });

    it('should handle connection timeout', async () => {
      const timeoutError = new Error('Connection timeout');
      timeoutError.name = 'TimeoutError';
      mockClientProxy.connect.mockRejectedValue(timeoutError);

      const errorSpy = jest.spyOn(Logger.prototype, 'error');

      await service.onModuleInit();

      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to connect to RabbitMQ Email MicroService',
        'Connection timeout',
      );
    });
  });

  describe('sendEmail', () => {
    const mockEmailData = {
      from: {
        email: 'test@example.com',
        name: 'Test Sender',
      },
      emailBody: {
        subject: 'Test Subject',
        to: 'recipient@example.com',
        cc: 'cc@example.com',
        bcc: 'bcc@example.com',
        message: {
          text: 'Test message',
          socketFile: Buffer.from('<html>Test HTML</html>', 'utf-8'),
        },
      },
    };

    it('should emit email with correct payload structure', () => {
      service.sendEmail(mockEmailData);

      expect(mockClientProxy.emit).toHaveBeenCalledTimes(1);
      expect(mockClientProxy.emit).toHaveBeenCalledWith('send', {
        auth: {
          username: 'test-user-123',
          password: 'test-password-456',
        },
        data: mockEmailData,
      });
    });

    it('should handle email data with minimal fields', () => {
      const minimalEmailData = {
        emailBody: {
          subject: 'Minimal Test',
          to: 'test@example.com',
          message: {
            text: 'Minimal message',
          },
        },
      };

      service.sendEmail(minimalEmailData);

      expect(mockClientProxy.emit).toHaveBeenCalledWith('send', {
        auth: {
          username: 'test-user-123',
          password: 'test-password-456',
        },
        data: minimalEmailData,
      });
    });

    it('should handle empty email data', () => {
      const emptyEmailData = {};

      service.sendEmail(emptyEmailData);

      expect(mockClientProxy.emit).toHaveBeenCalledWith('send', {
        auth: {
          username: 'test-user-123',
          password: 'test-password-456',
        },
        data: emptyEmailData,
      });
    });

    it('should handle null email data', () => {
      service.sendEmail(null);

      expect(mockClientProxy.emit).toHaveBeenCalledWith('send', {
        auth: {
          username: 'test-user-123',
          password: 'test-password-456',
        },
        data: null,
      });
    });

    it('should handle undefined email data', () => {
      service.sendEmail(undefined);

      expect(mockClientProxy.emit).toHaveBeenCalledWith('send', {
        auth: {
          username: 'test-user-123',
          password: 'test-password-456',
        },
        data: undefined,
      });
    });

    it('should use the same auth headers for multiple email sends', () => {
      const emailData1 = { subject: 'Email 1' };
      const emailData2 = { subject: 'Email 2' };

      service.sendEmail(emailData1);
      service.sendEmail(emailData2);

      expect(mockClientProxy.emit).toHaveBeenCalledTimes(2);

      const call1Args = mockClientProxy.emit.mock.calls[0];
      const call2Args = mockClientProxy.emit.mock.calls[1];

      expect((call1Args[1] as any).auth).toEqual((call2Args[1] as any).auth);
      expect((call1Args[1] as any).auth).toEqual({
        username: 'test-user-123',
        password: 'test-password-456',
      });
    });
  });

  describe('Email Data Variations', () => {
    it('should handle email with HTML content', () => {
      const htmlEmailData = {
        from: { email: 'sender@example.com', name: 'HTML Sender' },
        emailBody: {
          subject: 'HTML Email',
          to: 'recipient@example.com',
          message: {
            text: 'Plain text version',
            socketFile: Buffer.from(
              `
              <html>
                <body>
                  <h1>Welcome {{firstName}}!</h1>
                  <p>Your password is: {{tempPassword}}</p>
                </body>
              </html>
            `,
              'utf-8',
            ),
          },
        },
      };

      service.sendEmail(htmlEmailData);

      expect(mockClientProxy.emit).toHaveBeenCalledWith('send', {
        auth: expect.any(Object),
        data: htmlEmailData,
      });
    });

    it('should handle email with multiple recipients', () => {
      const multiRecipientEmailData = {
        emailBody: {
          subject: 'Multi-recipient Email',
          to: 'user1@example.com,user2@example.com,user3@example.com',
          cc: 'manager@example.com,admin@example.com',
          bcc: 'audit@example.com',
          message: {
            text: 'Message for multiple recipients',
          },
        },
      };

      service.sendEmail(multiRecipientEmailData);

      expect(mockClientProxy.emit).toHaveBeenCalledWith('send', {
        auth: expect.any(Object),
        data: multiRecipientEmailData,
      });
    });

    it('should handle email with special characters in subject', () => {
      const specialCharEmailData = {
        emailBody: {
          subject: '🔐 Welcome to PRMS - Bienvenido! 你好 #123 @test',
          to: 'test@example.com',
          message: {
            text: 'Email with special characters in subject',
          },
        },
      };

      service.sendEmail(specialCharEmailData);

      expect(mockClientProxy.emit).toHaveBeenCalledWith('send', {
        auth: expect.any(Object),
        data: specialCharEmailData,
      });
    });
  });

  describe('Error Scenarios', () => {
    it('should handle very large email data', () => {
      const largeContent = 'A'.repeat(1000000);
      const largeEmailData = {
        emailBody: {
          subject: 'Large Email',
          to: 'test@example.com',
          message: {
            text: largeContent,
            socketFile: Buffer.from(
              `<html><body>${largeContent}</body></html>`,
              'utf-8',
            ),
          },
        },
      };

      expect(() => {
        service.sendEmail(largeEmailData);
      }).not.toThrow();

      expect(mockClientProxy.emit).toHaveBeenCalledWith('send', {
        auth: expect.any(Object),
        data: largeEmailData,
      });
    });
  });

  describe('Integration Scenarios', () => {
    it('should work correctly after module initialization', async () => {
      mockClientProxy.connect.mockResolvedValue(undefined);

      await service.onModuleInit();

      const emailData = { subject: 'Post-init email' };
      service.sendEmail(emailData);

      expect(mockClientProxy.connect).toHaveBeenCalled();
      expect(mockClientProxy.emit).toHaveBeenCalledWith('send', {
        auth: expect.any(Object),
        data: emailData,
      });
    });

    it('should still send emails even if initial connection failed', async () => {
      mockClientProxy.connect.mockRejectedValue(
        new Error('Initial connection failed'),
      );

      await service.onModuleInit();

      const emailData = { subject: 'Email after failed connection' };
      service.sendEmail(emailData);

      expect(mockClientProxy.emit).toHaveBeenCalledWith('send', {
        auth: expect.any(Object),
        data: emailData,
      });
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle empty string config values', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'MS_NOTIFICATION_USER') return '';
        if (key === 'MS_NOTIFICATION_PASSWORD') return '';
        return null;
      });

      const serviceWithEmptyConfig = new EmailNotificationManagementService(
        mockClientProxy,
        mockConfigService,
      );

      const authHeader = (serviceWithEmptyConfig as any).authHeaderMs;
      expect(authHeader).toEqual({
        username: '',
        password: '',
      });
    });

    it('should handle config service throwing error', () => {
      mockConfigService.get.mockImplementation(() => {
        throw new Error('Config service error');
      });

      expect(() => {
        new EmailNotificationManagementService(
          mockClientProxy,
          mockConfigService,
        );
      }).toThrow('Config service error');
    });
  });
});
