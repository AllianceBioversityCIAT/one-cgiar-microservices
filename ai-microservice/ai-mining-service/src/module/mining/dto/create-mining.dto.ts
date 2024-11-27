import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../messages/enum/role.enum';
import { Tool } from '../../messages/enum/tool.enum';
import { UploadedFile } from '@nestjs/common';

export class CreateMiningDto {
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

  // @ApiProperty({
  //   description: 'The file to be uploaded',
  //   required: false
  // })
  // file?: Buffer;

  @ApiProperty({
    description: 'File data as a buffer encoded in base64',
    type: String,
    required: false,
  })
  fileData?: any;

  fileName?: string;
  mimeType?: string;
}
