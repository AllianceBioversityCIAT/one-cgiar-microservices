import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize logger with correct context', () => {
      // @ts-ignore - Accessing private property for testing
      expect(service['_logger']).toBeDefined();
      // @ts-ignore - Accessing private property for testing
      expect(service['_logger']).toBeInstanceOf(Logger);
      // @ts-ignore - Accessing private property for testing
      expect(service['_logger'].context).toBe('NotificationsService');
    });

    it('should set slackWebhookUrl from config', () => {
      const mockWebhookUrl = 'https://hooks.slack.com/services/test';
      configService.get.mockReturnValueOnce(mockWebhookUrl);

      const newService = new NotificationsService(configService);

      // @ts-ignore - Accessing private property for testing
      expect(newService['slackWebhookUrl']).toBe(mockWebhookUrl);
      expect(configService.get).toHaveBeenCalledWith('SLACK_WEBHOOK_URL');
    });

    it('should set isProduction to true when IS_PRODUCTION is "true"', () => {
      configService.get
        .mockReturnValueOnce('webhook-url') // for SLACK_WEBHOOK_URL
        .mockReturnValueOnce('true'); // for IS_PRODUCTION

      const newService = new NotificationsService(configService);

      // @ts-ignore - Accessing private property for testing
      expect(newService['isProduction']).toBe(true);
      expect(configService.get).toHaveBeenCalledWith('IS_PRODUCTION');
    });

    it('should set isProduction to false when IS_PRODUCTION is not "true"', () => {
      configService.get
        .mockReturnValueOnce('webhook-url') // for SLACK_WEBHOOK_URL
        .mockReturnValueOnce('false'); // for IS_PRODUCTION

      const newService = new NotificationsService(configService);

      // @ts-ignore - Accessing private property for testing
      expect(newService['isProduction']).toBe(false);
    });

    it('should set isProduction to false when IS_PRODUCTION is undefined', () => {
      configService.get
        .mockReturnValueOnce('webhook-url') // for SLACK_WEBHOOK_URL
        .mockReturnValueOnce(undefined); // for IS_PRODUCTION

      const newService = new NotificationsService(configService);

      // @ts-ignore - Accessing private property for testing
      expect(newService['isProduction']).toBe(false);
    });
  });

  describe('dependency injection', () => {
    it('should throw error when ConfigService is not provided', async () => {
      await expect(
        Test.createTestingModule({
          providers: [NotificationsService],
        }).compile(),
      ).rejects.toThrow();
    });

    it('should throw error when ConfigService is undefined', async () => {
      await expect(
        Test.createTestingModule({
          providers: [
            NotificationsService,
            {
              provide: ConfigService,
              useValue: undefined,
            },
          ],
        }).compile(),
      ).rejects.toThrow();
    });
  });

  describe('configuration validation', () => {
    it('should handle empty webhook URL', () => {
      configService.get
        .mockReturnValueOnce('') // empty SLACK_WEBHOOK_URL
        .mockReturnValueOnce('true');

      const newService = new NotificationsService(configService);

      // @ts-ignore - Accessing private property for testing
      expect(newService['slackWebhookUrl']).toBe('');
    });

    it('should handle null webhook URL', () => {
      configService.get
        .mockReturnValueOnce(null) // null SLACK_WEBHOOK_URL
        .mockReturnValueOnce('true');

      const newService = new NotificationsService(configService);

      // @ts-ignore - Accessing private property for testing
      expect(newService['slackWebhookUrl']).toBeNull();
    });
  });
});
