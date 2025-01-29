import { Test, TestingModule } from '@nestjs/testing';
import { AssistantService } from './assistant.service';
import { OpenaiService } from '../openai/openai.service';
import { HttpStatus } from '@nestjs/common';
import { CreateAssistantDto } from './dto/create-assistant.dto';
import { UpdateAssistantDto } from './dto/update-assistant.dto';

describe('AssistantService', () => {
  let service: AssistantService;
  let mockOpenaiService;

  const mockAssistant = {
    id: 'test-id',
    name: 'Test Assistant',
    instructions: 'Test instructions',
    tools: [],
    tool_resources: [],
    model: 'gpt-4',
  };

  const createDto: CreateAssistantDto = {
    name: 'Test Assistant',
    instructions: 'Test instructions',
    tools: [],
    model: 'gpt-4',
  };

  const updateDto: UpdateAssistantDto = {
    id: 1,
    name: 'Updated Assistant',
    instructions: 'Updated instructions',
  };

  beforeEach(async () => {
    mockOpenaiService = {
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
  });

  describe('create', () => {
    it('should successfully create an assistant', async () => {
      mockOpenaiService.openai.beta.assistants.create.mockResolvedValue(
        mockAssistant,
      );

      const result = await service.create(createDto);

      expect(result.status).toBe(HttpStatus.CREATED);
      expect(result.data).toEqual(mockAssistant);
      expect(result.description).toBe('Assistant created successfully');
    });

    it('should return bad request for missing fields', async () => {
      const result = await service.create({} as CreateAssistantDto);

      expect(result.status).toBe(HttpStatus.BAD_REQUEST);
      expect(result.data).toBeNull();
      expect(result.description).toBe('Missing required fields');
    });

    it('should handle creation errors', async () => {
      mockOpenaiService.openai.beta.assistants.create.mockRejectedValue(
        new Error('Creation failed'),
      );

      const result = await service.create(createDto);

      expect(result.status).toBe(HttpStatus.BAD_REQUEST);
      expect(result.data).toBeNull();
      expect(result.description).toBe('Error creating assistant');
    });
  });

  describe('findAll', () => {
    it('should successfully retrieve all assistants', async () => {
      mockOpenaiService.openai.beta.assistants.list.mockResolvedValue({
        data: [mockAssistant],
      });

      const result = await service.findAll();

      expect(result.status).toBe(HttpStatus.OK);
      expect(result.data).toEqual([mockAssistant]);
      expect(result.description).toBe('Assistants retrieved successfully');
    });

    it('should handle retrieval errors', async () => {
      mockOpenaiService.openai.beta.assistants.list.mockRejectedValue(
        new Error('Retrieval failed'),
      );

      const result = await service.findAll();

      expect(result.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(result.data).toBeNull();
      expect(result.description).toBe('Error retrieving assistants');
    });
  });

  describe('findOne', () => {
    it('should successfully retrieve an assistant', async () => {
      mockOpenaiService.openai.beta.assistants.retrieve.mockResolvedValue(
        mockAssistant,
      );

      const result = await service.findOne('test-id');

      expect(result.status).toBe(HttpStatus.OK);
      expect(result.data).toEqual(mockAssistant);
      expect(result.description).toBe('Assistant retrieved successfully');
    });

    it('should return not found for non-existent assistant', async () => {
      mockOpenaiService.openai.beta.assistants.retrieve.mockResolvedValue(null);

      const result = await service.findOne('non-existent-id');

      expect(result.status).toBe(HttpStatus.NOT_FOUND);
      expect(result.data).toBeNull();
      expect(result.description).toBe('Assistant not found');
    });

    it('should handle retrieval errors', async () => {
      mockOpenaiService.openai.beta.assistants.retrieve.mockRejectedValue(
        new Error('Retrieval failed'),
      );

      const result = await service.findOne('test-id');

      expect(result.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(result.data).toBeNull();
      expect(result.description).toBe('Error retrieving assistant');
    });
  });

  describe('update', () => {
    it('should successfully update an assistant', async () => {
      mockOpenaiService.openai.beta.assistants.retrieve.mockResolvedValue(
        mockAssistant,
      );
      mockOpenaiService.openai.beta.assistants.update.mockResolvedValue({
        ...mockAssistant,
        ...updateDto,
      });

      const result = await service.update('test-id', updateDto);

      expect(result.status).toBe(HttpStatus.OK);
      expect(result.data).toEqual({
        ...mockAssistant,
        ...updateDto,
      });
      expect(result.description).toBe('Assistant updated successfully');
    });

    it('should return not found for non-existent assistant', async () => {
      mockOpenaiService.openai.beta.assistants.retrieve.mockResolvedValue(null);

      const result = await service.update('non-existent-id', updateDto);

      expect(result.status).toBe(HttpStatus.NOT_FOUND);
      expect(result.data).toBeNull();
      expect(result.description).toBe('Assistant not found');
    });

    it('should handle update errors', async () => {
      mockOpenaiService.openai.beta.assistants.retrieve.mockResolvedValue(
        mockAssistant,
      );
      mockOpenaiService.openai.beta.assistants.update.mockRejectedValue(
        new Error('Update failed'),
      );

      const result = await service.update('test-id', updateDto);

      expect(result.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(result.data).toBeNull();
      expect(result.description).toBe('Error updating assistant');
    });

    it('should maintain existing values for undefined fields', async () => {
      mockOpenaiService.openai.beta.assistants.retrieve.mockResolvedValue(
        mockAssistant,
      );
      mockOpenaiService.openai.beta.assistants.update.mockImplementation(
        (id, data) => Promise.resolve({ ...mockAssistant, ...data }),
      );

      const partialUpdate = { id: 1 };
      const result = await service.update('test-id', partialUpdate);

      expect(result.status).toBe(HttpStatus.OK);
      expect(result.data.name).toBe('Test Assistant');
      expect(result.data.instructions).toBe(mockAssistant.instructions);
    });
  });

  describe('delete', () => {
    it('should successfully delete an assistant', async () => {
      mockOpenaiService.openai.beta.assistants.del.mockResolvedValue(
        mockAssistant,
      );

      const result = await service.delete('test-id');

      expect(result.status).toBe(HttpStatus.OK);
      expect(result.data).toEqual(mockAssistant);
      expect(result.description).toBe('Assistant deleted successfully');
    });

    it('should handle deletion errors', async () => {
      mockOpenaiService.openai.beta.assistants.del.mockRejectedValue(
        new Error('Deletion failed'),
      );

      const result = await service.delete('test-id');

      expect(result.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(result.data).toBeNull();
      expect(result.description).toBe('Error deleting assistant');
    });
  });

  describe('findModels', () => {
    it('should successfully retrieve models', async () => {
      const mockModels = [{ id: 'model-1' }, { id: 'model-2' }];
      mockOpenaiService.openai.models.list.mockResolvedValue({
        data: mockModels,
      });

      const result = await service.findModels();

      expect(result.status).toBe(HttpStatus.OK);
      expect(result.data).toEqual(mockModels);
      expect(result.description).toBe('Models retrieved successfully');
    });

    it('should handle model retrieval errors', async () => {
      mockOpenaiService.openai.models.list.mockRejectedValue(
        new Error('Retrieval failed'),
      );

      const result = await service.findModels();

      expect(result.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(result.data).toBeNull();
      expect(result.description).toBe('Error retrieving models');
    });
  });
});
