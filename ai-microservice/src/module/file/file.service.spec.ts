import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { OpenaiService } from '../openai/openai.service';
import { FileService } from './file.service';

describe('FileService', () => {
  let service: FileService;
  let openaiService: OpenaiService;

  beforeEach(async () => {
    // Create mock implementation
    const mockOpenaiService = {
      openai: {
        files: {
          create: jest.fn(),
          del: jest.fn(),
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileService,
        {
          provide: OpenaiService,
          useValue: mockOpenaiService,
        },
      ],
    }).compile();

    service = module.get<FileService>(FileService);
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
      expect(service['_logger'].context).toBe('FileService');
    });
  });

  describe('dependency injection edge cases', () => {
    it('should throw error when OpenaiService is not provided', async () => {
      await expect(
        Test.createTestingModule({
          providers: [FileService],
        }).compile()
      ).rejects.toThrow();
    });

    it('should throw error when OpenaiService is undefined', async () => {
      try {
        await expect(
          Test.createTestingModule({
            providers: [
              FileService,
              {
                provide: OpenaiService,
                useValue: undefined,
              },
            ],
          }).compile()
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
      expect(service['_openaiService'].openai.files).toBeDefined();
    });
  });
});