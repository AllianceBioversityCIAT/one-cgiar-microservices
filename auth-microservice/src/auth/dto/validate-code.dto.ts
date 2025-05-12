import { IsNotEmpty, IsString, IsNumber, IsInt } from 'class-validator';

export class ValidateCodeDto {
  @IsNotEmpty()
  @IsNumber()
  @IsInt()
  misId: string;

  @IsNotEmpty()
  @IsString()
  code: string;
}
