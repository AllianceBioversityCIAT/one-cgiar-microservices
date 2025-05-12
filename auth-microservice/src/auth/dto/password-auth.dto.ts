import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsNumber,
  IsInt,
} from 'class-validator';

export class PasswordAuthDto {
  @IsNotEmpty()
  @IsNumber()
  @IsInt()
  misId: string;

  @IsNotEmpty()
  @IsString()
  @IsEmail()
  username: string;

  @IsNotEmpty()
  @IsString()
  password: string;
}
