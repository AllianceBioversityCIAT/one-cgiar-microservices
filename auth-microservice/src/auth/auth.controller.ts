import { Controller, Post, Body, Query, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ProviderAuthDto } from './dto/provider-auth.dto';
import { PasswordAuthDto } from './dto/password-auth.dto';
import { ValidateCodeDto } from './dto/validate-code.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login/provider')
  async loginWithProvider(@Body() providerAuthDto: ProviderAuthDto) {
    return this.authService.authenticateWithProvider(providerAuthDto);
  }

  @Post('validate/code')
  async validateAuthorizationCode(@Body() validateCodeDto: ValidateCodeDto) {
    return this.authService.validateAuthorizationCode(validateCodeDto);
  }
}
