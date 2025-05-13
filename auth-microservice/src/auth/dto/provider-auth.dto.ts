import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsInt,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum AuthProvider {
  AZURE = 'CGIAR-AzureAD',
}

export class ProviderAuthDto {
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
    description: 'Authentication provider',
    example: 'CGIAR-AzureAD',
    enum: AuthProvider,
  })
  @IsNotEmpty()
  @IsString()
  provider: string;
}
