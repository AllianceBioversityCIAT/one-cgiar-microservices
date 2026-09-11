import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Request DTO for `POST /auth/login/otp/start` (OTP-R-7, design.md §4.2).
 * Mirrors `CustomAuthDto`'s validation style.
 */
export class EmailOtpStartDto {
  @ApiProperty({
    description: 'User email address (Cognito username)',
    example: 'user@icrisat.org',
  })
  @IsNotEmpty()
  @IsString()
  @IsEmail()
  username: string;
}
