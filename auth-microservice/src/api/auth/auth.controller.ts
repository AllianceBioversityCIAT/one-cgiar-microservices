import { Controller, Post, Body, Req, Get, Query } from '@nestjs/common';
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
  ApiQuery,
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
import {
  BulkCreateUsersDto,
  BulkCreationResponse,
} from './dto/bulk-user-registration.dto';
import { BulkUserService } from './services/bulk-registration/bulk-registration.service';

@ApiTags('Authetication and Authorization')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly bulkUserService: BulkUserService,
  ) {}

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
  @ApiClarisaAuth(
    'Register new user with auto-generated password and custom email',
  )
  @ApiOperation({
    summary: 'Register new user with auto-generated password and custom email',
    description: `Creates a new user in AWS Cognito with automatically generated secure password and sends personalized welcome email using RabbitMQ.`,
  })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully and email queued',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'User registered successfully',
          description: 'Success message',
        },
        userSub: {
          type: 'string',
          example: 'abc123-def456-ghi789',
          description: 'User unique identifier from Cognito',
        },
        temporaryPassword: {
          type: 'boolean',
          example: true,
          description: 'Indicates if a temporary password was generated',
        },
        emailSent: {
          type: 'boolean',
          example: true,
          description: 'Indicates if welcome email was queued successfully',
        },
        emailConfig: {
          type: 'object',
          properties: {
            appName: { type: 'string', example: 'PRMS Reporting Tool' },
            senderEmail: { type: 'string', example: 'noreply@prms.cgiar.org' },
            templateProcessed: { type: 'boolean', example: true },
            variablesUsed: { type: 'number', example: 8 },
            templateSize: { type: 'number', example: 2048 },
          },
          description: 'Email configuration processing summary',
        },
      },
    },
    examples: {
      'Success with email queued': {
        summary: 'User created and email queued successfully',
        value: {
          message: 'User registered successfully',
          userSub: 'abc123-def456-ghi789',
          temporaryPassword: true,
          emailSent: true,
          emailConfig: {
            appName: 'PRMS Reporting Tool',
            senderEmail: 'noreply@prms.cgiar.org',
            templateProcessed: true,
            variablesUsed: 8,
            templateSize: 2048,
          },
        },
      },
      'Success with email queue failure': {
        summary: 'User created but email queueing failed',
        value: {
          message: 'User registered successfully',
          userSub: 'abc123-def456-ghi789',
          temporaryPassword: true,
          emailSent: false,
          emailError: 'RabbitMQ connection failed',
          emailConfig: {
            appName: 'PRMS Reporting Tool',
            senderEmail: 'noreply@prms.cgiar.org',
            templateProcessed: true,
            variablesUsed: 8,
            templateSize: 2048,
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'Invalid request parameters, user already exists, email config invalid, or password generation failed',
    type: ErrorResponse,
    examples: {
      'User already exists': {
        summary: 'User already exists in Cognito',
        value: {
          statusCode: 400,
          message: 'User already exists in the system',
          path: '/auth/register',
          timestamp: '2025-06-10T12:34:56.789Z',
        },
      },
      'Invalid email config': {
        summary: 'Email configuration validation failed',
        value: {
          statusCode: 400,
          message:
            'Email configuration is invalid: sender_email es requerido, welcome_html_template debe contener la variable {{tempPassword}}',
          path: '/auth/register',
          timestamp: '2025-06-10T12:34:56.789Z',
        },
      },
      'Invalid user data': {
        summary: 'User data validation failed',
        value: {
          statusCode: 400,
          message: 'firstName should not be empty',
          path: '/auth/register',
          timestamp: '2025-06-10T12:34:56.789Z',
        },
      },
      'Password generation failed': {
        summary: 'Auto-generated password validation failed',
        value: {
          statusCode: 500,
          message:
            'Generated password is invalid: Must contain at least one symbol',
          path: '/auth/register',
          timestamp: '2025-06-10T12:34:56.789Z',
        },
      },
      'XSS prevention': {
        summary: 'HTML template contains forbidden elements',
        value: {
          statusCode: 400,
          message:
            'Email configuration is invalid: welcome_html_template no debe contener etiquetas <script>',
          path: '/auth/register',
          timestamp: '2025-06-10T12:34:56.789Z',
        },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description:
      'Password generation failed, Cognito service error, or RabbitMQ unavailable',
    type: ErrorResponse,
    examples: {
      'Cognito error': {
        summary: 'AWS Cognito service error',
        value: {
          statusCode: 500,
          message: 'User creation failed in Cognito User Pool',
          path: '/auth/register',
          timestamp: '2025-06-10T12:34:56.789Z',
        },
      },
      'Password generation error': {
        summary: 'Secure password generation failed',
        value: {
          statusCode: 500,
          message:
            'Failed to generate secure password meeting Cognito requirements',
          path: '/auth/register',
          timestamp: '2025-06-10T12:34:56.789Z',
        },
      },
      'RabbitMQ error': {
        summary: 'Email notification service unavailable',
        value: {
          statusCode: 500,
          message:
            'User created successfully but email notification service is unavailable',
          path: '/auth/register',
          timestamp: '2025-06-10T12:34:56.789Z',
        },
      },
    },
  })
  @ApiBody({
    type: RegisterUserDto,
    description:
      'User registration data with email configuration - password will be auto-generated',
    examples: {
      'PRMS Registration': {
        summary: 'Complete PRMS user registration',
        description: 'Registration with full PRMS branding and custom template',
        value: {
          username: 'john.doe@cgiar.org',
          email: 'john.doe@cgiar.org',
          firstName: 'John',
          lastName: 'Doe',
          emailConfig: {
            sender_email: 'noreply@prms.cgiar.org',
            sender_name: 'PRMS Team',
            welcome_subject:
              '🔐 Welcome to {{appName}} - Your Account is Ready!',
            app_name: 'PRMS Reporting Tool',
            app_url: 'https://prms.ciat.cgiar.org',
            support_email: 'support@prms.cgiar.org',
            logo_url:
              'https://prms-file-storage.s3.amazonaws.com/email-images/prms-logo.png',
            welcome_html_template:
              '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{text-align:center;border-bottom:2px solid #1976d2;padding-bottom:20px}.password-box{background:#e3f2fd;border:2px solid #1976d2;padding:20px;border-radius:8px;text-align:center;margin:20px 0}.password{font-family:monospace;font-size:18px;font-weight:bold;color:#1976d2}</style></head><body><div class="container"><div class="header"><img src="{{logoUrl}}" alt="{{appName}}" style="max-height:80px"><h1>Welcome to {{appName}}</h1></div><h2>Hello {{firstName}} {{lastName}},</h2><p>Your account has been created successfully! Here are your login credentials:</p><div class="password-box"><p><strong>Username:</strong> {{username}}</p><p><strong>Temporary Password:</strong></p><div class="password">{{tempPassword}}</div></div><p><strong>⚠️ Important:</strong> This is a temporary password. You will be required to change it on your first login for security.</p><p>Access your account: <a href="{{appUrl}}" style="color:#1976d2">{{appUrl}}</a></p><p>Need assistance? Contact: <a href="mailto:{{supportEmail}}">{{supportEmail}}</a></p><hr><p style="text-align:center;color:#666;font-size:12px">Best regards,<br>{{senderName}}<br><em>This is an automated message. Please do not reply.</em></p></div></body></html>',
          },
        },
      },
    },
  })
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
  async validateToken(@Body() body: { accessToken: string }) {
    return this.authService.validateToken(body.accessToken);
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

  @Post('bulk-create-users')
  @ApiClarisaAuth('Create users in bulk')
  @ApiOperation({
    summary: 'Create multiple users in AWS Cognito',
    description: `
    Creates multiple users in AWS Cognito in bulk.
    
    **Features:**
    - Automatically generates secure temporary passwords
    - Creates users in AWS Cognito with email validation
    - Sends welcome emails with temporary passwords
    - Returns detailed process report
    
    **Process:**
    1. Validates input data
    2. Generates temporary password for each user
    3. Creates user in Cognito with MessageAction SUPPRESS
    4. Sends personalized email via microservice
    5. Returns complete process statistics
    
    **Note:** Temporary passwords expire on first login and require immediate change.
  `,
  })
  @ApiBody({
    type: BulkCreateUsersDto,
    description: 'Array of users to create',
    examples: {
      'Basic example': {
        summary: 'Creating 3 users',
        description: 'Example with 3 different users',
        value: {
          users: [
            {
              email: 'john.doe@cgiar.org',
              username: 'john.doe',
              firstName: 'John',
              lastName: 'Doe',
            },
            {
              email: 'jane.smith@cgiar.org',
              username: 'jane.smith',
              firstName: 'Jane',
              lastName: 'Smith',
            },
            {
              email: 'bob.johnson@cgiar.org',
              username: 'bob.johnson',
              firstName: 'Bob',
              lastName: 'Johnson',
            },
          ],
        },
      },
      'Single user': {
        summary: 'Creating single user',
        description: 'Minimal example with one user',
        value: {
          users: [
            {
              email: 'admin@cgiar.org',
              username: 'admin',
              firstName: 'Administrator',
              lastName: 'User',
            },
          ],
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Users created successfully',
    type: BulkCreationResponse,
    schema: {
      example: {
        totalUsers: 3,
        successCount: 2,
        failedCount: 1,
        emailsSent: 2,
        emailsFailed: 0,
        results: [
          {
            email: 'john.doe@cgiar.org',
            username: 'john.doe',
            success: true,
            tempPassword: 'TempPass123!',
            emailSent: true,
          },
          {
            email: 'jane.smith@cgiar.org',
            username: 'jane.smith',
            success: true,
            tempPassword: 'SecureP@ss456',
            emailSent: true,
          },
          {
            email: 'existing@cgiar.org',
            username: 'existing',
            success: false,
            error: 'User already exists',
            emailSent: false,
          },
        ],
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data',
    type: ErrorResponse,
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error',
    type: ErrorResponse,
  })
  async bulkCreateUsers(
    @Body() bulkCreateUsersDto: BulkCreateUsersDto,
  ): Promise<BulkCreationResponse> {
    return this.bulkUserService.bulkCreateUsers(bulkCreateUsersDto);
  }

  @Get('users/search')
  @ApiClarisaAuth('Search users by multiple criteria')
  @ApiOperation({ summary: 'Search users by multiple criteria' })
  @ApiQuery({
    name: 'email',
    required: false,
    description: 'Email to search for',
  })
  @ApiQuery({
    name: 'firstName',
    required: false,
    description: 'First name to search for',
  })
  @ApiQuery({
    name: 'lastName',
    required: false,
    description: 'Last name to search for',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'User status to filter by',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of results (default: 60)',
  })
  async searchUsers(
    @Query('email') email?: string,
    @Query('firstName') firstName?: string,
    @Query('lastName') lastName?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: number,
  ): Promise<any[]> {
    const searchParams = {
      email,
      firstName,
      lastName,
      status,
      limit: limit || 60,
    };

    // Remove undefined values
    Object.keys(searchParams).forEach(
      (key) => searchParams[key] === undefined && delete searchParams[key],
    );

    return this.authService.searchUsers(searchParams);
  }
}
