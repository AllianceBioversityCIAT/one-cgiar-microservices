import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { AssistantService } from './assistant.service';
import { CreateAssistantDto } from './dto/create-assistant.dto';
import { UpdateAssistantDto } from './dto/update-assistant.dto';

@ApiTags('assistant')
@Controller()
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  // * CREATE
  @Post('create')
  @ApiOperation({ summary: 'Create a new assistant' })
  @ApiResponse({ status: 201, description: 'Assistant created successfully.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  @ApiBody({ type: CreateAssistantDto })
  createApi(@Body() createAssistantDto: CreateAssistantDto) {
    return this.assistantService.create(createAssistantDto);
  }

  @MessagePattern('createAssistant')
  create(@Payload() createAssistantDto: CreateAssistantDto) {
    return this.assistantService.create(createAssistantDto);
  }

  // * READ
  @Get('list-all')
  @ApiOperation({ summary: 'Get a list of all assistants' })
  @ApiResponse({
    status: 200,
    description: 'List of assistants retrieved successfully.',
  })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  findAllApi() {
    return this.assistantService.findAll();
  }

  @MessagePattern('getAssistants')
  findAll() {
    return this.assistantService.findAll();
  }

  // * READ BY ID
  @Get('list/:id')
  @ApiOperation({ summary: 'Get an assistant by ID' })
  @ApiResponse({
    status: 200,
    description: 'Assistant retrieved successfully.',
  })
  @ApiResponse({ status: 404, description: 'Assistant not found.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  @ApiParam({ name: 'id', required: true, description: 'ID of the assistant' })
  findOneApi(@Param('id') id: string) {
    return this.assistantService.findOne(id);
  }

  @MessagePattern('getAssistant')
  findOne(@Payload() id: string) {
    return this.assistantService.findOne(id);
  }

  // * UPDATE
  @Patch('update/:id')
  @ApiOperation({ summary: 'Update an assistant by ID' })
  @ApiResponse({ status: 200, description: 'Assistant updated successfully.' })
  @ApiResponse({ status: 404, description: 'Assistant not found.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  @ApiParam({ name: 'id', required: true, description: 'ID of the assistant' })
  @ApiBody({ type: UpdateAssistantDto })
  updateApi(
    @Param('id') id: string,
    @Body() updateAssistantDto: UpdateAssistantDto,
  ) {
    return this.assistantService.update(id, updateAssistantDto);
  }

  @MessagePattern('updateAssistant')
  update(
    @Payload() data: { id: string; updateAssistantDto: UpdateAssistantDto },
  ) {
    return this.assistantService.update(data.id, data.updateAssistantDto);
  }

  // * DELETE
  @Delete('delete/:id')
  @ApiOperation({ summary: 'Delete an assistant by ID' })
  @ApiResponse({ status: 200, description: 'Assistant deleted successfully.' })
  @ApiResponse({ status: 404, description: 'Assistant not found.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  @ApiParam({ name: 'id', required: true, description: 'ID of the assistant' })
  deleteApi(@Param('id') id: string) {
    return this.assistantService.delete(id);
  }

  @MessagePattern('deleteAssistant')
  delete(@Payload() id: string) {
    return this.assistantService.delete(id);
  }

  // * FIND MODELS
  @Get('models')
  @ApiOperation({ summary: 'Get a list of available models' })
  @ApiResponse({
    status: 200,
    description: 'List of models retrieved successfully.',
  })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  findModelsApi() {
    return this.assistantService.findModels();
  }
}
