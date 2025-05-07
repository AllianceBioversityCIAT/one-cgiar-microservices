import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { FileService } from '../file/file.service';
import { OpenaiService } from '../openai/openai.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessagesService } from './messages.service';
import { Tool } from './enum/tool.enum';
import { Role } from './enum/role.enum';

describe('MessagesService', () => {
  let service: MessagesService;
  let openaiService: jest.Mocked<OpenaiService>;
  let fileService: jest.Mocked<FileService>;

  const mockFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'test.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    buffer: Buffer.from('test content'),
    size: 1234,
    destination: '',
    filename: '',
    path: '',
    stream: null as any,
  };

  const mockCreateMessageDto: CreateMessageDto = {
    assistantId: 'test-assistant-id',
    threadId: 'test-thread-id',
    role: Role.User,
    tool: 'file_search' as Tool,
    content: 'Test content',
  };

  const mockUploadResponse = {
    id: 'test-file-id',
  };

  beforeEach(async () => {
    const mockOpenaiService = {
      openai: {
        beta: {
          threads: {
            messages: {
              create: jest.fn(),
            },
            runs: {
              create: jest.fn(),
            },
          },
        },
      },
    };

    const mockFileService = {
      uploadFile: jest.fn(),
      deleteFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        {
          provide: OpenaiService,
          useValue: mockOpenaiService,
        },
        {
          provide: FileService,
          useValue: mockFileService,
        },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
    openaiService = module.get(OpenaiService);
    fileService = module.get(FileService);
  });

  describe('create', () => {
    it('should return BAD_REQUEST when no file is provided', async () => {
      const result = await service.create(mockCreateMessageDto, undefined);

      expect(result).toEqual({
        data: null,
        description: 'File is required',
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('should successfully process message with file and return result', async () => {
      // Arrange
      fileService.uploadFile.mockResolvedValue({
        id: 'test-file-id',
        bytes: 1234,
        created_at: Date.now(),
        filename: 'test.pdf',
        object: 'file',
        purpose: 'assistants',
        status: 'processed',
      });

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            event: 'thread.message.delta',
            data: {
              delta: {
                content: [{ type: 'text', text: { value: 'Processing...' } }],
              },
            },
          };
          yield {
            event: 'thread.message.completed',
            data: {
              content: [{ text: { value: 'Final result' } }],
            },
          };
        },
      };

      // @ts-ignore
      openaiService.openai.beta.threads.runs.create.mockResolvedValue(
        mockStream,
      );
      fileService.deleteFile.mockResolvedValue(undefined);

      // Act
      const result = await service.create(mockCreateMessageDto, mockFile);

      // Assert
      expect(fileService.uploadFile).toHaveBeenCalledWith(mockFile);
      expect(
        openaiService.openai.beta.threads.messages.create,
      ).toHaveBeenCalledWith(mockCreateMessageDto.threadId, {
        role: mockCreateMessageDto.role,
        content: mockCreateMessageDto.content,
        attachments: [
          {
            file_id: mockUploadResponse.id,
            tools: [{ type: mockCreateMessageDto.tool }],
          },
        ],
      });
      expect(fileService.deleteFile).toHaveBeenCalledWith(
        mockUploadResponse.id,
      );
      expect(result).toEqual({
        data: 'Final result',
        description: 'Information retrieved successfully',
        status: HttpStatus.CREATED,
      });
    });

    it('should handle empty stream result', async () => {
      // Arrange
      fileService.uploadFile.mockResolvedValue({
        id: 'test-file-id',
        bytes: 1234,
        created_at: Date.now(),
        filename: 'test.pdf',
        object: 'file',
        purpose: 'assistants',
        status: 'processed',
      });

      const mockEmptyStream = {
        async *[Symbol.asyncIterator]() {
          // Empty stream
        },
      };

      // @ts-ignore
      openaiService.openai.beta.threads.runs.create.mockResolvedValue(
        mockEmptyStream,
      );

      // Act
      const result = await service.create(mockCreateMessageDto, mockFile);

      // Assert
      expect(result).toEqual({
        data: null,
        description: 'Failed to get response',
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    it('should handle service errors', async () => {
      // Arrange
      const error = new Error('Service error');
      fileService.uploadFile.mockRejectedValue(error);

      // Act
      const result = await service.create(mockCreateMessageDto, mockFile);

      // Assert
      expect(result).toEqual({
        data: null,
        description: error.message,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        errors: error,
      });
    });
  });
});
