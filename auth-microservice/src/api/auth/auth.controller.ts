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
import { ChangePasswordDto } from './dto/change-password.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { NewPasswordChallengeDto } from './dto/new-password-challenge.dto';

@ApiTags('Authetication and Authorization')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login/provider')
  @ApiClarisaAuth('Authenticate with OAuth provider')
  @ApiOperation({ summary: 'Authenticate user with OAuth provider' })
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
  async loginWithProvider(
    @Body() providerAuthDto: ProviderAuthDto,
    @Req() request: RequestWithCustomAttrs,
  ) {
    return this.authService.authenticateWithProvider(providerAuthDto, request);
  }

  @Post('login/custom')
  @ApiClarisaAuth('Authenticate user with custom password')
  @ApiOperation({ summary: 'Authenticate user with custom password' })
  @ApiResponse({
    status: 200,
    description: 'Returns authentication tokens and user info',
    type: TokenResponse,
  })
  @ApiResponse({ status: 401, description: 'Authentication failed' })
  @ApiBody({ type: CustomAuthDto })
  async loginWithCustomPassword(@Body() customAuthDto: CustomAuthDto) {
    return this.authService.authenticateWithCustomPassword(customAuthDto);
  }

  @Post('validate/code')
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
  async validateAuthorizationCode(
    @Body() validateCodeDto: ValidateCodeDto,
    @Req() request: RequestWithCustomAttrs,
  ) {
    return this.authService.validateAuthorizationCode(validateCodeDto, request);
  }

  @Post('userinfo')
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
  async getUserInfo(@Body() body: { accessToken: string }) {
    return this.authService.getUserInfo(body.accessToken);
  }

  @Post('register')
  @ApiClarisaAuth('Register new user with custom password')
  @ApiOperation({ summary: 'Register new user in Cognito User Pool' })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'User registered successfully' },
        userSub: { type: 'string', example: 'abc123-def456-ghi789' },
        temporaryPassword: { type: 'boolean', example: true },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid request parameters or user already exists',
    type: ErrorResponse,
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error',
    type: ErrorResponse,
  })
  @ApiBody({ type: RegisterUserDto })
  async registerUser(
    @Body() registerUserDto: RegisterUserDto,
    @Req() request: RequestWithCustomAttrs,
  ) {
    return this.authService.registerUser(registerUserDto, request);
  }

  @Post('update-user')
  @ApiClarisaAuth('Update user information')
  @ApiOperation({ summary: 'Update user attributes in Cognito User Pool' })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'User updated successfully' },
        username: { type: 'string', example: 'user@example.com' },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid request parameters or user not found',
    type: ErrorResponse,
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error',
    type: ErrorResponse,
  })
  @ApiBody({ type: UpdateUserDto })
  async updateUser(
    @Body() updateUserDto: UpdateUserDto,
    @Req() request: RequestWithCustomAttrs,
  ) {
    return this.authService.updateUser(updateUserDto, request);
  }

  @Post('change-password')
  @ApiClarisaAuth('Change user password')
  @ApiOperation({ summary: 'Change user password in Cognito User Pool' })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Password changed successfully' },
        username: { type: 'string', example: 'user@example.com' },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid request parameters or current password incorrect',
    type: ErrorResponse,
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error',
    type: ErrorResponse,
  })
  @ApiBody({ type: ChangePasswordDto })
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() request: RequestWithCustomAttrs,
  ) {
    return this.authService.changePassword(changePasswordDto, request);
  }

  @Post('/complete-new-password-challenge')
  @ApiClarisaAuth('Complete new password challenge')
  @ApiOperation({ summary: 'Complete new password challenge' })
  @ApiResponse({
    status: 200,
    description: 'Password set successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Password set successfully' },
        tokens: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            idToken: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid challenge parameters',
    type: ErrorResponse,
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error',
    type: ErrorResponse,
  })
  @ApiBody({ type: NewPasswordChallengeDto })
  async completeNewPasswordChallenge(
    @Body() challengeDto: NewPasswordChallengeDto,
  ) {
    return this.authService.completeNewPasswordChallenge(challengeDto);
  }
  @Post('validate-token')
  @ApiClarisaAuth('Validate access token')
  @ApiOperation({ summary: 'Validate if access token is still valid' })
  @ApiResponse({
    status: 200,
    description: 'Token is valid',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean', example: true },
        userInfo: {
          type: 'object',
          properties: {
            sub: { type: 'string' },
            email: { type: 'string' },
            name: { type: 'string' },
          },
        },
        expiresAt: { type: 'number', example: 1647891234 },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid or expired token',
    type: ErrorResponse,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        accessToken: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          description: 'Access token to validate',
        },
      },
      required: ['accessToken'],
    },
  })
  async validateToken(
    @Body() body: { accessToken: string },
    @Req() request: RequestWithCustomAttrs,
  ) {
    return this.authService.validateToken(body.accessToken, request);
  }

  @Post('refresh')
  @ApiClarisaAuth('Refresh authentication tokens')
  @ApiOperation({ summary: 'Get new access token using refresh token' })
  @ApiResponse({
    status: 200,
    description: 'Returns new tokens',
    type: TokenResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid refresh token or MIS ID',
    type: ErrorResponse,
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error',
    type: ErrorResponse,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        refreshToken: {
          type: 'string',
          example:
            'eyJjdHk6IkpXVCIsImVuYyI6IkEyNTZHQ00iLCJhbGciOiJSU0EtT0FFUCJ9...',
          description: 'Valid refresh token obtained from login',
        },
      },
      required: ['refreshToken'],
    },
  })
  async refreshToken(
    @Body() body: { refreshToken: string },
    @Req() request: RequestWithCustomAttrs,
  ) {
    return this.authService.refreshAuthenticationTokens(
      body.refreshToken,
      request,
    );
  }
}
