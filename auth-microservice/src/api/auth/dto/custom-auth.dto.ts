import { IsNotEmpty, IsString, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CustomAuthDto {
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