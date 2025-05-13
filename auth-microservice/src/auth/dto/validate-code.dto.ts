import { IsNotEmpty, IsString, IsNumber, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidateCodeDto {
  @ApiProperty({
    description: 'Management Information System ID',
    example: 123,
    type: Number,
  })
  @IsNotEmpty()
  @IsNumber()
  @IsInt()
  misId: string;

  @ApiProperty({
    description: 'Authorization code returned from OAuth provider',
    example: 'auth-code-123456',
  })
  @IsNotEmpty()
  @IsString()
  code: string;
}
