import {
  Injectable,
  HttpException,
  HttpStatus,
  Req,
  Logger,
} from '@nestjs/common';
import { ProviderAuthDto } from './dto/provider-auth.dto';
import { ValidateCodeDto } from './dto/validate-code.dto';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { RequestWithCustomAttrs } from '../../middleware/jwt-clarisa.middleware';
import { CustomAuthDto } from './dto/custom-auth.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { NewPasswordChallengeDto } from './dto/new-password-challenge.dto';
import { CognitoService } from './services/cognito/cognito.service';
import { DynamicEmailService } from './services/dynamic-email/dynamic-email.service';
import { PasswordGeneratorService } from './services/password/password.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly cognitoService: CognitoService,
    private readonly dynamicEmailService: DynamicEmailService,
    private readonly passwordGenerator: PasswordGeneratorService,
  ) {}

  /**
   * Creates authentication URL for provider-based login
   * @param providerAuthDto Provider auth parameters
   * @param request Express request with MIS metadata
   * @returns Authentication URL
   */
  async authenticateWithProvider(
    providerAuthDto: ProviderAuthDto,
    @Req() request: RequestWithCustomAttrs,
  ) {
    try {
      const misMetadata = request.senderMisMetadata;

      if (!misMetadata || !misMetadata.mis_auth) {
        this.logger.error(
          'MIS authentication information not found in request',
        );
        throw new HttpException(
          'MIS authentication information not found',
          HttpStatus.BAD_REQUEST,
        );
      }

      const cognitoUrl = this.configService.get<string>('COGNITO_URL');
      const authUrl = `${cognitoUrl}/oauth2/authorize?response_type=code&client_id=${misMetadata.mis_auth.cognito_client_id}&redirect_uri=${misMetadata.mis_auth.auth_url}&scope=openid+email+profile&identity_provider=${providerAuthDto.provider}`;

      this.logger.log(
        `Generated auth URL for provider ${providerAuthDto.provider}`,
      );
      return {
        authUrl,
      };
    } catch (error) {
      this.logger.error('Error during provider authentication:', error);
      throw new HttpException(
        error.message || 'Authentication URL generation failed',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Validates authorization code and returns tokens
   * @param validateCodeDto Validation parameters
   * @param request Express request with MIS metadata
   * @returns Token information and user profile
   */
  async validateAuthorizationCode(
    validateCodeDto: ValidateCodeDto,
    @Req() request: RequestWithCustomAttrs,
  ) {
    try {
      const misMetadata = request.senderMisMetadata;

      if (!misMetadata || !misMetadata.mis_auth) {
        this.logger.error(
          'MIS authentication information not found in request',
        );
        throw new HttpException(
          'MIS authentication information not found',
          HttpStatus.BAD_REQUEST,
        );
      }

      const cognitoUrl = this.configService.get<string>('COGNITO_URL');
      const tokenEndpoint = `${cognitoUrl}/oauth2/token`;

      this.logger.debug(
        `Using Cognito client ID: ${misMetadata.mis_auth.cognito_client_id}`,
      );
      this.logger.debug(`Using redirect URI: ${misMetadata.mis_auth.auth_url}`);

      const params = new URLSearchParams();
      params.append('grant_type', 'authorization_code');
      params.append('client_id', misMetadata.mis_auth.cognito_client_id);
      params.append(
        'client_secret',
        misMetadata.mis_auth.cognito_client_secret,
      );
      params.append('code', validateCodeDto.code);
      params.append('redirect_uri', misMetadata.mis_auth.auth_url);

      const tokenResponse = await firstValueFrom(
        this.httpService.post(tokenEndpoint, params.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );

      const tokens = {
        accessToken: tokenResponse.data.access_token,
        idToken: tokenResponse.data.id_token,
        refreshToken: tokenResponse.data.refresh_token,
        expiresIn: tokenResponse.data.expires_in,
        tokenType: tokenResponse.data.token_type,
      };

      const userInfo = await this.getUserInfo(tokens.accessToken);

      return {
        ...tokens,
        userInfo,
      };
    } catch (error) {
      this.logger.error('Error validating authorization code:', error);

      if (error.response) {
        throw new HttpException(
          `Authentication failed: ${error.response.data.error_description || error.response.data.error}`,
          HttpStatus.UNAUTHORIZED,
        );
      }

      throw new HttpException(
        error.message || 'Error validating authorization code',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Authenticates user with custom password flow
   * @param customAuthDto Custom authentication parameters
   * @returns Authentication result with tokens or challenge information
   */
  async authenticateWithCustomPassword(customAuthDto: CustomAuthDto) {
    try {
      const { username, password } = customAuthDto;

      const authResult = await this.cognitoService.loginWithCustomPassword(
        username,
        password,
      );

      if (authResult?.challengeName === 'NEW_PASSWORD_REQUIRED') {
        this.logger.log(`User ${username} needs to set a new password`);

        return {
          challengeName: authResult.challengeName,
          session: authResult.session,
          userAttributes: authResult.userAttributes,
          userId: authResult.userId,
          message: 'Password change required. User must set a new password.',
        };
      }

      const tokens = {
        accessToken: authResult.AuthenticationResult.AccessToken,
        idToken: authResult.AuthenticationResult.IdToken,
        refreshToken: authResult.AuthenticationResult.RefreshToken,
        expiresIn: authResult.AuthenticationResult.ExpiresIn,
        tokenType: authResult.AuthenticationResult.TokenType,
      };

      return {
        tokens,
      };
    } catch (error) {
      this.logger.error('Authentication failed', error);
      throw new HttpException('Authentication failed', HttpStatus.UNAUTHORIZED);
    }
  }

  /**
   * Completes the new password challenge for Cognito users
   * @param challengeDto New password challenge data
   * @returns Success message and authentication tokens
   */
  async completeNewPasswordChallenge(
    challengeDto: NewPasswordChallengeDto,
  ): Promise<any> {
    try {
      const result = await this.cognitoService.completeNewPasswordChallenge(
        challengeDto.username,
        challengeDto.newPassword,
        challengeDto.session,
      );

      return {
        message: 'Password updated successfully',
        tokens: {
          accessToken: result.AuthenticationResult.AccessToken,
          idToken: result.AuthenticationResult.IdToken,
          refreshToken: result.AuthenticationResult.RefreshToken,
          expiresIn: result.AuthenticationResult.ExpiresIn,
          tokenType: result.AuthenticationResult.TokenType,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets user information from access token
   * @param accessToken Access token
   * @returns User profile information
   */
  async getUserInfo(accessToken: string) {
    try {
      const cognitoUrl = this.configService.get<string>('COGNITO_URL');
      const userInfoEndpoint = `${cognitoUrl}/oauth2/userInfo`;

      this.logger.debug(`Fetching user info from ${userInfoEndpoint}`);

      const response = await firstValueFrom(
        this.httpService.get(userInfoEndpoint, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      );

      this.logger.debug('User info fetched successfully');
      return response.data;
    } catch (error) {
      this.logger.error('Error getting user info:', error);
      throw new HttpException(
        'Error retrieving user information',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  /**
   * Register a new user in Cognito with auto-generated password and dynamic email
   * @param registerUserDto User registration data including email config
   * @param request Express request with MIS metadata
   * @returns Registration result with email status
   */
  async registerUser(
    registerUserDto: RegisterUserDto,
    @Req() request: RequestWithCustomAttrs,
  ): Promise<any> {
    try {
      const misMetadata = request.senderMisMetadata;

      if (!misMetadata || !misMetadata.mis_auth) {
        this.logger.error(
          'MIS authentication information not found in request',
        );
        throw new HttpException(
          'MIS authentication information not found',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(
        `🚀 Starting registration for user: ${registerUserDto.username}`,
      );

      const emailConfigValidation =
        this.dynamicEmailService.validateEmailConfig(
          registerUserDto.emailConfig,
        );

      if (!emailConfigValidation.isValid) {
        this.logger.error(
          `❌ Email configuration validation failed: ${emailConfigValidation.errors.join(', ')}`,
        );
        throw new HttpException(
          `Email configuration is invalid: ${emailConfigValidation.errors.join(', ')}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(
        `✅ Email configuration validated for: ${registerUserDto.emailConfig.app_name}`,
      );

      const temporaryPassword = this.passwordGenerator.generateSecurePassword(
        12,
        true,
        true,
      );

      const passwordValidation =
        this.passwordGenerator.validateCognitoPassword(temporaryPassword);
      if (!passwordValidation.isValid) {
        this.logger.error(
          `❌ Generated password validation failed: ${passwordValidation.errors.join(', ')}`,
        );
        throw new HttpException(
          `Generated password is invalid: ${passwordValidation.errors.join(', ')}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const env = this.configService.get<string>('ENV')?.toLowerCase();
      const email = registerUserDto.email;
      let username = registerUserDto.username;

      if (env === 'test') {
        username = email;
      } else if (env === 'prod') {
        username = email.split('@')[0];
      }

      const result = await this.cognitoService.createUser(
        username,
        temporaryPassword,
        registerUserDto.firstName,
        registerUserDto.lastName,
        registerUserDto.email,
      );

      this.logger.log(
        `✅ User created in Cognito: ${registerUserDto.username} (${result.userSub})`,
      );

      let emailSent = false;
      let emailError = null;

      try {
        emailSent = await this.dynamicEmailService.sendWelcomeEmail(
          registerUserDto,
          temporaryPassword,
          registerUserDto.emailConfig,
        );

        if (emailSent) {
          this.logger.log(
            `✅ Welcome email queued successfully for: ${registerUserDto.email}`,
          );
        } else {
          this.logger.warn(
            `⚠️ Failed to queue welcome email for: ${registerUserDto.email}`,
          );
        }
      } catch (error) {
        emailError = error.message;
        this.logger.error(
          `❌ Email queueing failed: ${error.message}`,
          error.stack,
        );

        emailSent = false;
      }

      const templateStats = this.dynamicEmailService.getEmailStats(
        registerUserDto.emailConfig.welcome_html_template,
      );

      const response = {
        message: 'User registered successfully',
        userSub: result.userSub,
        temporaryPassword: true,
        emailSent: emailSent,
        emailConfig: {
          appName: registerUserDto.emailConfig.app_name,
          senderEmail: registerUserDto.emailConfig.sender_email,
          templateProcessed: true,
          variablesUsed: templateStats.variableCount,
          templateSize: templateStats.templateSize,
        },
      };

      if (emailError) {
        response['emailError'] = emailError;
      }

      this.logger.log(
        `🎉 Registration completed successfully for: ${registerUserDto.username}`,
      );
      return response;
    } catch (error) {
      this.logger.error(
        `❌ Error registering user: ${error.message}`,
        error.stack,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        error.message || 'User registration failed',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Update user information in Cognito
   * @param updateUserDto User update data
   * @param request Express request with MIS metadata
   * @returns Update result
   */
  async updateUser(
    updateUserDto: UpdateUserDto,
    @Req() request: RequestWithCustomAttrs,
  ): Promise<any> {
    try {
      const misMetadata = request.senderMisMetadata;

      if (!misMetadata || !misMetadata.mis_auth) {
        this.logger.error(
          'MIS authentication information not found in request',
        );
        throw new HttpException(
          'MIS authentication information not found',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(`Updating user: ${updateUserDto.username}`);

      await this.cognitoService.updateUser(updateUserDto);

      return {
        message: 'User updated successfully',
        username: updateUserDto.username,
      };
    } catch (error) {
      this.logger.error(`Error updating user: ${error.message}`, error.stack);
      throw new HttpException(
        error.message || 'User update failed',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Change user password in Cognito
   * @param changePasswordDto Password change data
   * @param request Express request with MIS metadata
   * @returns Password change result
   */
  async changePassword(
    changePasswordDto: ChangePasswordDto,
    @Req() request: RequestWithCustomAttrs,
  ): Promise<any> {
    try {
      const misMetadata = request.senderMisMetadata;

      if (!misMetadata || !misMetadata.mis_auth) {
        this.logger.error(
          'MIS authentication information not found in request',
        );
        throw new HttpException(
          'MIS authentication information not found',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(
        `Changing password for user: ${changePasswordDto.username}`,
      );

      await this.cognitoService.changeUserPassword(
        changePasswordDto.username,
        changePasswordDto.currentPassword,
        changePasswordDto.newPassword,
        misMetadata.mis_auth.cognito_client_id,
        misMetadata.mis_auth.cognito_client_secret,
      );

      return {
        message: 'Password changed successfully',
        username: changePasswordDto.username,
      };
    } catch (error) {
      this.logger.error(
        `Error changing password: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        error.message || 'Password change failed',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Validate if an access token is still valid
   * @param accessToken Access token to validate
   * @param request Express request with MIS metadata
   * @returns Token validation result
   */
  async validateToken(accessToken: string): Promise<any> {
    try {
      if (!accessToken) {
        throw new HttpException(
          'Access token is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log('Validating access token');

      const tokenInfo =
        await this.cognitoService.validateAccessToken(accessToken);

      const userInfo = await this.getUserInfo(accessToken);

      return {
        valid: true,
        userInfo: userInfo,
        expiresAt: tokenInfo.exp,
        tokenUse: tokenInfo.token_use,
        clientId: tokenInfo.client_id,
      };
    } catch (error) {
      this.logger.error('Token validation failed:', error);

      if (
        error.name === 'TokenExpiredError' ||
        error.name === 'NotAuthorizedException'
      ) {
        return {
          valid: false,
          error: 'Token expired or invalid',
          code: 'TOKEN_EXPIRED',
        };
      }

      throw new HttpException(
        error.message || 'Token validation failed',
        error.status || HttpStatus.UNAUTHORIZED,
      );
    }
  }

  /**
   * Refresh authentication tokens using refresh token
   * @param refreshToken Valid refresh token
   * @param request Express request with MIS metadata
   * @returns New authentication tokens
   */
  async refreshAuthenticationTokens(
    refreshToken: string,
    @Req() request: RequestWithCustomAttrs,
  ): Promise<any> {
    try {
      const misMetadata = request.senderMisMetadata;

      if (!misMetadata || !misMetadata.mis_auth) {
        this.logger.error(
          'MIS authentication information not found in request',
        );
        throw new HttpException(
          'MIS authentication information not found',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!refreshToken) {
        throw new HttpException(
          'Refresh token is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log('Refreshing authentication tokens');

      const newTokens = await this.cognitoService.refreshAccessToken(
        refreshToken,
        misMetadata.mis_auth.cognito_client_id,
        misMetadata.mis_auth.cognito_client_secret,
      );

      const userInfo = await this.getUserInfo(newTokens.accessToken);

      return {
        accessToken: newTokens.accessToken,
        idToken: newTokens.idToken,
        refreshToken: newTokens.refreshToken || refreshToken,
        expiresIn: newTokens.expiresIn,
        tokenType: newTokens.tokenType || 'Bearer',
        userInfo,
      };
    } catch (error) {
      this.logger.error('Error refreshing authentication tokens:', error);

      if (
        error.name === 'NotAuthorizedException' ||
        error.message?.includes('Refresh Token has expired')
      ) {
        throw new HttpException(
          'Refresh token has expired. Please login again.',
          HttpStatus.UNAUTHORIZED,
        );
      }

      if (error.response) {
        throw new HttpException(
          `Token refresh failed: ${error.response.data.error_description || error.response.data.error}`,
          HttpStatus.UNAUTHORIZED,
        );
      }

      throw new HttpException(
        error.message || 'Error refreshing authentication tokens',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
