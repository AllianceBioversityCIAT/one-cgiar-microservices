import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsInt,
} from 'class-validator';

export enum AuthProvider {
  AZURE = 'CGIAR-AzureAD',
}

export class ProviderAuthDto {
  @IsNotEmpty()
  @IsNumber()
  @IsInt()
  misId: string;

  @IsNotEmpty()
  @IsString()
  provider: string;
}
