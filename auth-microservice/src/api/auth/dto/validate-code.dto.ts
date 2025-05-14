import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidateCodeDto {
  @ApiProperty({
    description: 'Authorization code returned by the OAuth provider',
    example: 'abc123xyz',
  })
  @IsNotEmpty()
  @IsString()
  code: string;
}
