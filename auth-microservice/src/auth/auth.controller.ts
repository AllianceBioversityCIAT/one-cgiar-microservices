import { Controller, Post, Body, Query, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ProviderAuthDto } from './dto/provider-auth.dto';
import { PasswordAuthDto } from './dto/password-auth.dto';
import { ValidateCodeDto } from './dto/validate-code.dto';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBody,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiUnauthorizedResponse 
} from '@nestjs/swagger';
import { AuthUrlResponse, TokenResponse, ErrorResponse } from '../common/swagger/responses';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Authenticate with OAuth provider' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns authentication URL for the specified provider',
    type: AuthUrlResponse
  })
  @ApiBadRequestResponse({ 
    description: 'Invalid request parameters or MIS ID',
    type: ErrorResponse
  })
  @ApiInternalServerErrorResponse({ 
    description: 'Internal server error',
    type: ErrorResponse
  })
  @ApiBody({ type: ProviderAuthDto })
  @Post('login/provider')
  async loginWithProvider(@Body() providerAuthDto: ProviderAuthDto) {
    return this.authService.authenticateWithProvider(providerAuthDto);
  }

  @ApiOperation({ summary: 'Validate OAuth authorization code and retrieve tokens' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns OAuth tokens',
    type: TokenResponse
  })
  @ApiUnauthorizedResponse({ 
    description: 'Invalid authorization code',
    type: ErrorResponse
  })
  @ApiBadRequestResponse({ 
    description: 'Invalid request parameters or MIS ID',
    type: ErrorResponse
  })
  @ApiInternalServerErrorResponse({ 
    description: 'Internal server error',
    type: ErrorResponse
  })
  @ApiBody({ type: ValidateCodeDto })
  @Post('validate/code')
  async validateAuthorizationCode(@Body() validateCodeDto: ValidateCodeDto) {
    return this.authService.validateAuthorizationCode(validateCodeDto);
  }
}
