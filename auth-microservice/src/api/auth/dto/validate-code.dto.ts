import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ValidateCodeDto {
  @ApiProperty({
    description: 'Authorization code returned by the OAuth provider',
    example: 'abc123xyz',
  })
  @IsNotEmpty()
  @IsString()
  code: string;

  @ApiPropertyOptional({
    description: 'OAuth redirect URI used when the authorization code was obtained',
    example: 'https://prtest.ciat.cgiar.org/auth',
  })
  @IsOptional()
  @IsString()
  redirectUri?: string;
}
