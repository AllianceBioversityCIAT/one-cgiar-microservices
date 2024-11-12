import {
  IsString,
  IsEnum,
  IsArray,
  ValidateNested,
  IsEmpty,
  IsObject,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AssistantTool } from 'openai/resources/beta/assistants';
import { ApiProperty } from '@nestjs/swagger';

enum ToolType {
  CODE_INTERPRETER = 'code_interpreter',
  FILE_SEARCH = 'file_search',
  FUNCTION = 'function',
}

class Tool {
  @IsEnum(ToolType)
  type: ToolType;
}

export class CreateAssistantDto {
  @ApiProperty({
    required: true,
    description: 'The instructions for the assistant.',
    example: 'This assistant will help you with your coding needs.',
  })
  @IsString()
  instructions: string;

  @ApiProperty({
    required: true,
    description: 'The name of the assistant.',
    example: 'Code Interpreter',
  })
  @IsString()
  name: string;

  @ApiProperty({
    required: true,
    description: 'The tools for the assistant.',
    example: [{ type: 'file_search' }],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Tool)
  tools: AssistantTool[];

  @ApiProperty({
    required: false,
    description: 'The resources associated with the tools.',
    example: {
      file_search: {
        vector_store_ids: ['vs_123'],
      },
    },
  })
  @IsObject()
  @IsEmpty()
  tool_resources?: {
    file_search: {
      vector_store_ids: string[];
    };
  };

  @ApiProperty({
    required: true,
    description: 'The model of the assistant.',
    example: 'text-davinci-003',
  })
  @IsString()
  @IsNotEmpty()
  model: string;
}
