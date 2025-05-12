import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { CognitoService } from './cognito/cognito.service';
import { MisService } from './mis/mis.service';
import { ProviderAuthDto } from './dto/provider-auth.dto';
import { ConfigService } from '@nestjs/config';
import { ValidateCodeDto } from './dto/validate-code.dto';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class AuthService {
  constructor(
    private readonly misService: MisService,
    private readonly cognitoService: CognitoService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  async authenticateWithProvider(
    providerAuthDto: ProviderAuthDto,
  ): Promise<any> {
    try {
      const misInfo = await this.misService.getMisInfo(providerAuthDto.misId);

      if (!misInfo.mis_auth) {
        throw new HttpException(
          'MIS authentication information not found',
          HttpStatus.BAD_REQUEST,
        );
      }

      const cognitoUrl = this.configService.get<string>('COGNITO_URL');
      const authUrl = `${cognitoUrl}/oauth2/authorize?response_type=code&client_id=${misInfo.mis_auth.cognito_client_id}&redirect_uri=${misInfo.mis_auth.auth_url}&scope=openid+email+profile&identity_provider=${providerAuthDto.provider}`;

      return {
        authUrl,
      };
    } catch (error) {
      console.error('Error during provider authentication:', error);
      throw new HttpException(
        error.message || 'Authentication URL generation failed',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async validateAuthorizationCode(
    validateCodeDto: ValidateCodeDto,
  ): Promise<any> {
    try {
      const misInfo = await this.misService.getMisInfo(validateCodeDto.misId);

      if (!misInfo.mis_auth) {
        throw new HttpException(
          'MIS authentication information not found',
          HttpStatus.BAD_REQUEST,
        );
      }

      const cognitoUrl = this.configService.get<string>('COGNITO_URL');
      const tokenEndpoint = `${cognitoUrl}/oauth2/token`;

      const params = new URLSearchParams();
      params.append('grant_type', 'authorization_code');
      params.append('client_id', misInfo.mis_auth.cognito_client_id);
      params.append('client_secret', misInfo.mis_auth.cognito_client_secret);
      params.append('code', validateCodeDto.code);
      params.append('redirect_uri', misInfo.mis_auth.auth_url);

      const response = await firstValueFrom(
        this.httpService.post(tokenEndpoint, params.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );

      return {
        accessToken: response.data.access_token,
        idToken: response.data.id_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
        tokenType: response.data.token_type,
      };
    } catch (error) {
      console.error('Error validating authorization code:', error);

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
}
