import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CreateAssistantDto } from './dto/create-assistant.dto';
import { UpdateAssistantDto } from './dto/update-assistant.dto';
import { OpenaiService } from '../openai/openai.service';
import { ResponseUtils } from '../../utils/response.utils';

@Injectable()
export class AssistantService {
  private _logger = new Logger(AssistantService.name);
  constructor(private readonly _openaiService: OpenaiService) {}

  async create(createAssistantDto: CreateAssistantDto) {
    try {
      const { instructions, name, tools, tool_resources, model } =
        createAssistantDto;

      if (!instructions || !name || !tools || !tool_resources || !model) {
        return ResponseUtils.format({
          data: null,
          description: 'Missing required fields',
          status: HttpStatus.BAD_REQUEST,
          errors: 'Some required fields are missing',
        });
      }

      const assistant = await this._openaiService.openai.beta.assistants.create(
        {
          instructions,
          name,
          tools,
          tool_resources,
          model,
        },
      );

      return ResponseUtils.format({
        data: assistant,
        description: 'Assistant created successfully',
        status: HttpStatus.CREATED,
      });
    } catch (error) {
      this._logger.error(error);
      return ResponseUtils.format({
        data: null,
        description: 'Error creating assistant',
        errors: error,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  }

  async findAll() {
    try {
      const assistants = await this._openaiService.openai.beta.assistants.list({
        order: 'desc',
      });

      return ResponseUtils.format({
        data: assistants.data,
        description: 'Assistants retrieved successfully',
        status: HttpStatus.OK,
      });
    } catch (error) {
      this._logger.error(error);
      return ResponseUtils.format({
        data: null,
        description: 'Error retrieving assistants',
        errors: error,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  }

  async findOne(id: string) {
    try {
      this._logger.log(`Retrieving assistant with ID: ${id}`);
      const assistant =
        await this._openaiService.openai.beta.assistants.retrieve(id);

      if (!assistant) {
        this._logger.error('Assistant not found');
        return ResponseUtils.format({
          data: null,
          description: 'Assistant not found',
          status: HttpStatus.NOT_FOUND,
        });
      }

      this._logger.log('Assistant retrieved successfully');
      return ResponseUtils.format({
        data: assistant,
        description: 'Assistant retrieved successfully',
        status: HttpStatus.OK,
      });
    } catch (error) {
      this._logger.error(error);
      return ResponseUtils.format({
        data: null,
        description: 'Error retrieving assistant',
        errors: error,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  }

  async update(id: string, updateAssistantDto: UpdateAssistantDto) {
    try {
      const existingAssistant = await this.findOne(id);

      if (!existingAssistant.data) {
        this._logger.error('Assistant not found');
        return ResponseUtils.format({
          data: null,
          description: 'Assistant not found',
          status: HttpStatus.NOT_FOUND,
        });
      }

      const assistant = await this._openaiService.openai.beta.assistants.update(
        id,
        {
          instructions:
            updateAssistantDto.instructions ||
            existingAssistant.data.instructions,
          name: updateAssistantDto.name || existingAssistant.data.name,
          tools: updateAssistantDto.tools || existingAssistant.data.tools,
          tool_resources:
            updateAssistantDto?.tool_resources ||
            existingAssistant?.data?.tool_resources,
          model: updateAssistantDto.model || existingAssistant.data.model,
        },
      );

      return ResponseUtils.format({
        data: assistant,
        description: 'Assistant updated successfully',
        status: HttpStatus.OK,
      });
    } catch (error) {
      this._logger.error(error);
      return ResponseUtils.format({
        data: null,
        description: 'Error updating assistant',
        errors: error,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  }

  async delete(id: string) {
    try {
      const assistant =
        await this._openaiService.openai.beta.assistants.del(id);

      return ResponseUtils.format({
        data: assistant,
        description: 'Assistant deleted successfully',
        status: HttpStatus.OK,
      });
    } catch (error) {
      this._logger.error(error);
      return ResponseUtils.format({
        data: null,
        description: 'Error deleting assistant',
        errors: error,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  }

  async findModels() {
    try {
      const list = await this._openaiService.openai.models.list();

      return ResponseUtils.format({
        data: list.data,
        description: 'Models retrieved successfully',
        status: HttpStatus.OK,
      });
    } catch (error) {
      this._logger.error(error);
      return ResponseUtils.format({
        data: null,
        description: 'Error retrieving models',
        errors: error,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  }
}
