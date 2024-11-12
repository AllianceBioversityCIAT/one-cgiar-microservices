import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';

@Controller()
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @MessagePattern('createMessage')
  create(@Payload() createMessageDto: CreateMessageDto) {
    return this.messagesService.create(createMessageDto);
  }

  @MessagePattern('findAllMessages')
  findAll() {
    return this.messagesService.findAll();
  }

  @MessagePattern('findOneMessage')
  findOne(@Payload() id: number) {
    return this.messagesService.findOne(id);
  }

  @MessagePattern('updateMessage')
  update(@Payload() updateMessageDto: UpdateMessageDto) {
    return this.messagesService.update(updateMessageDto.id, updateMessageDto);
  }

  @MessagePattern('removeMessage')
  remove(@Payload() id: number) {
    return this.messagesService.remove(id);
  }
}
