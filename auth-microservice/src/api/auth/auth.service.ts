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
import { CognitoService } from './cognito/cognito.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly cognitoService: CognitoService,
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
   * Authenticates a user using username and password
   * @param customAuthDto Custom auth credentials
   * @returns Authentication result with tokens
   */
  async authenticateWithCustomPassword(
    customAuthDto: CustomAuthDto,
  ): Promise<any> {
    this.logger.log('Authenticating user with custom password');

    try {
      const { username, password } = customAuthDto;

      const authResult = await this.cognitoService.loginWithCustomPassword(
        username,
        password,
      );

      const tokens = {
        accessToken: authResult.AuthenticationResult.AccessToken,
        idToken: authResult.AuthenticationResult.IdToken,
        refreshToken: authResult.AuthenticationResult.RefreshToken,
        expiresIn: authResult.AuthenticationResult.ExpiresIn,
        tokenType: authResult.AuthenticationResult.TokenType,
      };

      const userInfo = await this.getUserInfo(tokens.accessToken);

      return {
        tokens,
        userInfo,
      };
    } catch (error) {
      this.logger.error('Authentication failed', error);
      throw new HttpException('Authentication failed', HttpStatus.UNAUTHORIZED);
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
}
