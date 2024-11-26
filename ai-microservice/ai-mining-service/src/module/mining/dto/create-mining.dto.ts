import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../messages/enum/role.enum';
import { Tool } from '../../messages/enum/tool.enum';

export class CreateMiningDto {
  //   @ApiProperty({
  //     description: 'The ID of the assistant',
  //     example: 'asst_abc123',
  //     type: String,
  //     required: true,
  //   })
  //   assistantId: string;

  // @ApiProperty({
  //   description: 'The content of the message',
  //   example: 'thread_abc123',
  //   type: String,
  //   required: true,
  // })
  // threadId: string;

  @ApiProperty({
    description: 'The role of the sender, either user or assistant',
    example: Role.User,
    enum: Role,
    required: true,
  })
  role: Role;

  @ApiProperty({
    description: 'The tool used to create the message',
    example: Tool.CodeInterpreterTool,
    enum: Tool,
    required: true,
  })
  tool: Tool;

  @ApiProperty({
    description: 'The content of the message',
    example: 'I need help',
    type: String,
    required: true,
  })
  content: string;

  // @ApiProperty({
  //   description: 'The file attachment',
  //   type: 'object',
  //   properties: {
  //     file: {
  //       type: 'string',
  //       format: 'binary',
  //     },
  //   },
  // })
  // file: Express.Multer.File;
}
