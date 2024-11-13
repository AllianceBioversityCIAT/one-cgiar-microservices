import { Body, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller()
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post('add')
  @UseInterceptors(FileInterceptor('file'))
  createApi(
    @Body() createMessageDto: CreateMessageDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.messagesService.create(createMessageDto, file);
  }

  @MessagePattern('createMessage')
  createMicroservice(
    @Payload() createMessageDto: CreateMessageDto,
    @Payload() file: Express.Multer.File,
  ) {
    return this.messagesService.create(createMessageDto, file);
  }
}
