import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { ThreadsService } from './threads.service';
import { CreateThreadDto } from './dto/create-thread.dto';

@ApiTags('threads')
@Controller()
export class ThreadsController {
  constructor(private readonly threadsService: ThreadsService) {}

  // * CREATE
  @Post('create')
  @ApiOperation({ summary: 'Create a new thread' })
  @ApiResponse({ status: 201, description: 'Thread created successfully.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  @ApiBody({ type: CreateThreadDto })
  createApi(@Body() createThreadDto: CreateThreadDto) {
    return this.threadsService.create(createThreadDto);
  }

  @MessagePattern('createThread')
  create(@Payload() createThreadDto: CreateThreadDto) {
    return this.threadsService.create(createThreadDto);
  }

  // * RETRIEVE
  @Get('retrieve/:threadId')
  @ApiOperation({ summary: 'Retrieve a thread by ID' })
  @ApiResponse({ status: 200, description: 'Thread retrieved successfully.' })
  @ApiResponse({ status: 404, description: 'Thread not found.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  @ApiParam({
    name: 'threadId',
    required: true,
    description: 'ID of the thread',
  })
  retrieveApi(@Param('threadId') threadId: string) {
    return this.threadsService.retrieve(threadId);
  }

  @MessagePattern('retrieveThread')
  retrieve(@Payload() threadId: string) {
    return this.threadsService.retrieve(threadId);
  }

  // * DELETE
  @Get('delete/:threadId')
  @ApiOperation({ summary: 'Delete a thread by ID' })
  @ApiResponse({ status: 200, description: 'Thread deleted successfully.' })
  @ApiResponse({ status: 404, description: 'Thread not found.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  @ApiParam({
    name: 'threadId',
    required: true,
    description: 'ID of the thread',
  })
  deleteApi(@Param('threadId') threadId: string) {
    return this.threadsService.delete(threadId);
  }

  @MessagePattern('deleteThread')
  delete(@Payload() threadId: string) {
    return this.threadsService.delete(threadId);
  }
}
