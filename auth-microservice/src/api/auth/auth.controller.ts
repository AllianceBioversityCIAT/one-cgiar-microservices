import { Controller, Post, Body, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ProviderAuthDto } from './dto/provider-auth.dto';
import { ValidateCodeDto } from './dto/validate-code.dto';
import {
  ApiTags,
  ApiResponse,
  ApiBody,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { RequestWithCustomAttrs } from '../../middleware/jwt-clarisa.middleware';
import { ApiClarisaAuth } from '../../shared/decorator/clarisa-auth.decorator';
import {
  AuthUrlResponse,
  ErrorResponse,
  TokenResponse,
} from '../../shared/swagger/responses-swagger';
import { CustomAuthDto } from './dto/custom-auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiClarisaAuth('Authenticate with OAuth provider')
  @ApiResponse({
    status: 200,
    description: 'Returns authentication URL for the specified provider',
    type: AuthUrlResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid request parameters or MIS ID',
    type: ErrorResponse,
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error',
    type: ErrorResponse,
  })
  @ApiBody({ type: ProviderAuthDto })
  @Post('login/provider')
  async loginWithProvider(
    @Body() providerAuthDto: ProviderAuthDto,
    @Req() request: RequestWithCustomAttrs,
  ) {
    return this.authService.authenticateWithProvider(providerAuthDto, request);
  }

  @ApiClarisaAuth('Validate OAuth authorization code and retrieve tokens')
  @ApiResponse({
    status: 200,
    description: 'Returns OAuth tokens',
    type: TokenResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid request parameters or MIS ID',
    type: ErrorResponse,
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error',
    type: ErrorResponse,
  })
  @ApiBody({ type: ValidateCodeDto })
  @Post('validate/code')
  async validateAuthorizationCode(
    @Body() validateCodeDto: ValidateCodeDto,
    @Req() request: RequestWithCustomAttrs,
  ) {
    return this.authService.validateAuthorizationCode(validateCodeDto, request);
  }

  @ApiClarisaAuth('Get user information from access token')
  @ApiResponse({
    status: 200,
    description: 'Returns user profile information',
    schema: {
      type: 'object',
      properties: {
        sub: { type: 'string' },
        email: { type: 'string' },
        name: { type: 'string' },
      },
    },
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        accessToken: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      },
      required: ['accessToken'],
    },
  })
  @Post('userinfo')
  async getUserInfo(@Body() body: { accessToken: string }) {
    return this.authService.getUserInfo(body.accessToken);
  }

  @Post('login/custom')
  @ApiOperation({ summary: 'Authenticate user with custom password' })
  @ApiResponse({
    status: 200,
    description: 'Returns authentication tokens and user info',
  })
  @ApiResponse({ status: 401, description: 'Authentication failed' })
  async loginWithCustomPassword(
    @Body() customAuthDto: CustomAuthDto,
  ): Promise<any> {
    return this.authService.authenticateWithCustomPassword(customAuthDto);
  }
}
