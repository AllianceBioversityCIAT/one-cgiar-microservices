import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../../notifications/notifications.service';
import { ClarisaService } from '../../tools/clarisa/clarisa.service';
import { AssistantService } from '../assistant/assistant.service';
import { MessagesService } from '../messages/messages.service';
import { ThreadsService } from '../threads/threads.service';
import { MiningService } from './mining.service';

describe('MiningService', () => {
  let service: MiningService;
  let configService: ConfigService;
  let notificationsService: NotificationsService;
  let assistantService: AssistantService;
  let threadsService: ThreadsService;
  let messagesService: MessagesService;
  let clarisaService: ClarisaService;

  beforeEach(async () => {
    // Create mock implementations
    const mockConfigService = {
      get: jest.fn(),
    };

    const mockNotificationsService = {
      sendSlackNotification: jest.fn(),
    };

    const mockAssistantService = {
      findOne: jest.fn(),
    };

    const mockThreadsService = {
      create: jest.fn(),
    };

    const mockMessagesService = {
      create: jest.fn(),
    };

    const mockClarisaService = {
      createConnection: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MiningService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: AssistantService,
          useValue: mockAssistantService,
        },
        {
          provide: ThreadsService,
          useValue: mockThreadsService,
        },
        {
          provide: MessagesService,
          useValue: mockMessagesService,
        },
        {
          provide: ClarisaService,
          useValue: mockClarisaService,
        },
      ],
    }).compile();

    service = module.get<MiningService>(MiningService);
    configService = module.get<ConfigService>(ConfigService);
    notificationsService =
      module.get<NotificationsService>(NotificationsService);
    assistantService = module.get<AssistantService>(AssistantService);
    threadsService = module.get<ThreadsService>(ThreadsService);
    messagesService = module.get<MessagesService>(MessagesService);
    clarisaService = module.get<ClarisaService>(ClarisaService);
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have ConfigService injected', () => {
      expect(service['configService']).toBeDefined();
      expect(service['configService']).toEqual(configService);
    });

    it('should have NotificationsService injected', () => {
      expect(service['_notificationsService']).toBeDefined();
      expect(service['_notificationsService']).toEqual(notificationsService);
    });

    it('should have AssistantService injected', () => {
      expect(service['_assistantService']).toBeDefined();
      expect(service['_assistantService']).toEqual(assistantService);
    });

    it('should have ThreadsService injected', () => {
      expect(service['_threadsService']).toBeDefined();
      expect(service['_threadsService']).toEqual(threadsService);
    });

    it('should have MessagesService injected', () => {
      expect(service['_messageService']).toBeDefined();
      expect(service['_messageService']).toEqual(messagesService);
    });

    it('should have ClarisaService injected', () => {
      expect(service['_clarisaService']).toBeDefined();
      expect(service['_clarisaService']).toEqual(clarisaService);
    });
  });

  describe('dependency injection edge cases', () => {
    it('should throw error when ConfigService is not provided', async () => {
      await expect(
        Test.createTestingModule({
          providers: [
            MiningService,
            { provide: NotificationsService, useValue: {} },
            { provide: AssistantService, useValue: {} },
            { provide: ThreadsService, useValue: {} },
            { provide: MessagesService, useValue: {} },
            { provide: ClarisaService, useValue: {} },
          ],
        }).compile(),
      ).rejects.toThrow();
    });

    it('should throw error when any required service is not provided', async () => {
      await expect(
        Test.createTestingModule({
          providers: [MiningService],
        }).compile(),
      ).rejects.toThrow();
    });
  });
});
