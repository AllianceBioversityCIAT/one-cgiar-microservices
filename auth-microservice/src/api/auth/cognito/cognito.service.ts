import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class CognitoService {
  private readonly cognitoClient: CognitoIdentityProviderClient;

  constructor(private readonly configService: ConfigService) {
    this.cognitoClient = new CognitoIdentityProviderClient({
      region: this.configService.get<string>('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get<string>(
          'AWS_SECRET_ACCESS_KEY',
        ),
      },
    });
  }

  private calculateSecretHash(
    username: string,
    clientId: string,
    clientSecret: string,
  ): string {
    const message = username + clientId;
    const hmac = crypto.createHmac('sha256', clientSecret);
    hmac.update(message);

    return hmac.digest('base64');
  }

  /**
   * Realiza una autenticación directa contra el endpoint de Cognito usando HTTP POST
   * @param username Nombre de usuario (email)
   * @param password Contraseña
   * @returns Respuesta de la autenticación
   */
  async loginWithCustomPassword(
    username: string,
    password: string,
  ): Promise<any> {
    try {
      const clientId = this.configService.get<string>('COGNITO_CLIENT_ID_USER');
      const clientSecret = this.configService.get<string>(
        'COGNITO_CLIENT_SECRET_USER_PASS',
      );
      const secretHash = this.calculateSecretHash(
        username,
        clientId,
        clientSecret,
      );

      const payload = {
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: clientId,
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
          SECRET_HASH: secretHash,
        },
      };

      const headers = {
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
        'Content-Type': 'application/x-amz-json-1.1',
      };

      const response = await fetch(
        this.configService.get<string>('COGNITO_USER_POOL_URL'),
        {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new HttpException(
          errorData.message || 'Authentication failed',
          response.status,
        );
      }

      return await response.json();
    } catch (error) {
      throw new HttpException(
        error.message || 'Authentication failed',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }
}
