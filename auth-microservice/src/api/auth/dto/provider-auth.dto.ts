import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AuthProvider {
  AZURE = 'CGIAR-AzureAD',
}

export class ProviderAuthDto {
  @ApiProperty({
    description: 'Identity provider name',
    example: 'CGIAR-AzureAD',
    enum: AuthProvider,
  })
  @IsNotEmpty()
  @IsString()
  provider: string;

  @ApiPropertyOptional({
    description: 'OAuth redirect URI to use for this request',
    example: 'https://prtest.ciat.cgiar.org/auth',
  })
  @IsOptional()
  @IsString()
  redirectUri?: string;
}
