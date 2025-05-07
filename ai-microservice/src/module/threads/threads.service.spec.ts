import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { ThreadsService } from './threads.service';
import { OpenaiService } from '../openai/openai.service';

describe('ThreadsService', () => {
  let service: ThreadsService;
  let openaiService: jest.Mocked<OpenaiService>;

  const mockThread = {
    id: 'thread_123',
    object: 'thread',
    created_at: 1699979300,
    metadata: {},
  };

  beforeEach(async () => {
    const mockOpenaiService = {
      openai: {
        beta: {
          threads: {
            retrieve: jest.fn(),
          },
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThreadsService,
        {
          provide: OpenaiService,
          useValue: mockOpenaiService,
        },
      ],
    }).compile();

    service = module.get<ThreadsService>(ThreadsService);
    openaiService = module.get(OpenaiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('retrieve', () => {
    it('should successfully retrieve a thread', async () => {
      // Arrange
      const threadId = 'thread_123';
      // @ts-ignore
      openaiService.openai.beta.threads.retrieve.mockResolvedValue(mockThread);

      // Act
      const result = await service.retrieve(threadId);

      // Assert
      expect(result).toEqual({
        data: mockThread,
        description: 'Thread retrieved successfully',
        status: HttpStatus.ACCEPTED,
      });
      expect(openaiService.openai.beta.threads.retrieve).toHaveBeenCalledWith(
        threadId,
      );
      expect(openaiService.openai.beta.threads.retrieve).toHaveBeenCalledTimes(
        1,
      );
    });

    it('should return BAD_REQUEST when threadId is empty', async () => {
      // Act
      const result = await service.retrieve('');

      // Assert
      expect(result).toEqual({
        data: null,
        description: 'Missing thread ID',
        status: HttpStatus.BAD_REQUEST,
        errors: 'Some required fields are missing',
      });
      expect(openaiService.openai.beta.threads.retrieve).not.toHaveBeenCalled();
    });

    it('should return BAD_REQUEST when threadId is undefined', async () => {
      // Act
      const result = await service.retrieve(undefined as unknown as string);

      // Assert
      expect(result).toEqual({
        data: null,
        description: 'Missing thread ID',
        status: HttpStatus.BAD_REQUEST,
        errors: 'Some required fields are missing',
      });
      expect(openaiService.openai.beta.threads.retrieve).not.toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
      // Arrange
      const threadId = 'thread_123';
      const error = new Error('API Error');
      // @ts-ignore
      openaiService.openai.beta.threads.retrieve.mockRejectedValue(error);

      // Act
      const result = await service.retrieve(threadId);

      // Assert
      expect(result).toEqual({
        data: null,
        description: 'Error retrieving thread',
        errors: error,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
      expect(openaiService.openai.beta.threads.retrieve).toHaveBeenCalledWith(
        threadId,
      );
    });

    it('should handle network errors', async () => {
      // Arrange
      const threadId = 'thread_123';
      const error = new Error('Network Error');
      // @ts-ignore
      openaiService.openai.beta.threads.retrieve.mockRejectedValue(error);

      // Act
      const result = await service.retrieve(threadId);

      // Assert
      expect(result).toEqual({
        data: null,
        description: 'Error retrieving thread',
        errors: error,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    it('should log errors when they occur', async () => {
      // Arrange
      const threadId = 'thread_123';
      const error = new Error('Test Error');
      const loggerSpy = jest.spyOn(service['_logger'], 'error');
      // @ts-ignore
      openaiService.openai.beta.threads.retrieve.mockRejectedValue(error);

      // Act
      await service.retrieve(threadId);

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(error);
    });
  });
});
