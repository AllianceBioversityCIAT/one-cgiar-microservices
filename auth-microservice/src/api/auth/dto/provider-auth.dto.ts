import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
}
