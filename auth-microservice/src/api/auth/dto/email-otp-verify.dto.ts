import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Request DTO for `POST /auth/login/otp/verify` (OTP-R-7, design.md §4.2).
 * Mirrors `CustomAuthDto`'s validation style.
 */
export class EmailOtpVerifyDto {
  @ApiProperty({
    description: 'User email address (Cognito username)',
    example: 'user@icrisat.org',
  })
  @IsNotEmpty()
  @IsString()
  @IsEmail()
  username: string;

  @ApiProperty({
    description: 'EMAIL_OTP code sent to the user (4-10 digits)',
    example: '12345678',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4,10}$/)
  code: string;

  @ApiProperty({
    description: 'Cognito challenge session returned by the start endpoint',
    example: 'AYABe...',
  })
  @IsString()
  @IsNotEmpty()
  session: string;
}
