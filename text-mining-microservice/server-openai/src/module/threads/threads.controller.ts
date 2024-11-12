import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ThreadsService } from './threads.service';
import { CreateThreadDto } from './dto/create-thread.dto';
import { UpdateThreadDto } from './dto/update-thread.dto';

@Controller()
export class ThreadsController {
  constructor(private readonly threadsService: ThreadsService) {}

  @MessagePattern('createThread')
  create(@Payload() createThreadDto: CreateThreadDto) {
    return this.threadsService.create(createThreadDto);
  }
}
