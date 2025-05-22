import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class NewPasswordChallengeDto {
  @ApiProperty({ description: 'Username' })
  @IsNotEmpty()
  @IsString()
  username: string;

  @ApiProperty({ description: 'New password' })
  @IsNotEmpty()
  @IsString()
  newPassword: string;

  @ApiProperty({ description: 'Session token from login challenge' })
  @IsNotEmpty()
  @IsString()
  session: string;
}
