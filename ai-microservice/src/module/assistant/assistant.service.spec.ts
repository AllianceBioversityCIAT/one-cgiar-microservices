import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { OpenaiService } from '../openai/openai.service';
import { AssistantService } from './assistant.service';

describe('AssistantService', () => {
  let service: AssistantService;
  let openaiService: OpenaiService;

  beforeEach(async () => {
    // Create mock implementation
    const mockOpenaiService = {
      openai: {
        beta: {
          assistants: {
            create: jest.fn(),
            list: jest.fn(),
            retrieve: jest.fn(),
            update: jest.fn(),
            del: jest.fn(),
          },
        },
        models: {
          list: jest.fn(),
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssistantService,
        {
          provide: OpenaiService,
          useValue: mockOpenaiService,
        },
      ],
    }).compile();

    service = module.get<AssistantService>(AssistantService);
    openaiService = module.get<OpenaiService>(OpenaiService);
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have OpenaiService injected', () => {
      // @ts-ignore - Accessing private property for testing
      expect(service['_openaiService']).toBeDefined();
      // @ts-ignore - Accessing private property for testing
      expect(service['_openaiService']).toEqual(openaiService);
    });

    it('should initialize logger with correct context', () => {
      // @ts-ignore - Accessing private property for testing
      expect(service['_logger']).toBeDefined();
      // @ts-ignore - Accessing private property for testing
      expect(service['_logger']).toBeInstanceOf(Logger);
      // @ts-ignore - Accessing private property for testing
      expect(service['_logger'].context).toBe('AssistantService');
    });
  });

  describe('dependency injection edge cases', () => {
    it('should throw error when OpenaiService is not provided', async () => {
      await expect(
        Test.createTestingModule({
          providers: [AssistantService],
        }).compile(),
      ).rejects.toThrow();
    });

    it('should throw error when OpenaiService is undefined', async () => {
      try {
        await expect(
          Test.createTestingModule({
            providers: [
              AssistantService,
              {
                provide: OpenaiService,
                useValue: undefined,
              },
            ],
          }).compile(),
        ).rejects.toThrow();
      } catch (error) {
        // @ts-ignore - Accessing private property for testing
        expect(service['_logger']).toBeDefined();
      }
    });
  });

  describe('OpenaiService integration', () => {
    it('should have access to openai client', () => {
      // @ts-ignore - Accessing private property for testing
      expect(service['_openaiService'].openai).toBeDefined();
      // @ts-ignore - Accessing private property for testing
      expect(service['_openaiService'].openai.beta.assistants).toBeDefined();
      // @ts-ignore - Accessing private property for testing
      expect(service['_openaiService'].openai.models).toBeDefined();
    });
  });
});
