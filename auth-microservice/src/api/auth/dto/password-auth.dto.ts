import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsNumber,
  IsInt,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PasswordAuthDto {
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
    description: 'User email address',
    example: 'user@cgiar.org',
  })
  @IsNotEmpty()
  @IsString()
  @IsEmail()
  username: string;

  @ApiProperty({
    description: 'User password',
    example: 'Password123!',
  })
  @IsNotEmpty()
  @IsString()
  password: string;
}
