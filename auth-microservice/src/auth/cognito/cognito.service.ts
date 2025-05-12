import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  AdminInitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';
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

  async loginWithAzureAD(username: string, password: string): Promise<any> {
    try {
      const clientId = this.configService.get<string>('COGNITO_CLIENT_ID_AD');
      const clientSecret = this.configService.get<string>('CLIENT_SECRET_AD');
      const secretHash = this.calculateSecretHash(
        username,
        clientId,
        clientSecret,
      );

      const command = new AdminInitiateAuthCommand({
        UserPoolId: this.configService.get<string>('COGNITO_USER_POOL_ID'),
        ClientId: clientId,
        AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
          SECRET_HASH: secretHash,
        },
      });

      const response = await this.cognitoClient.send(command);
      return response;
    } catch (error) {
      throw new HttpException('Authentication failed', HttpStatus.UNAUTHORIZED);
    }
  }

  async loginWithCustomPassword(
    username: string,
    password: string,
  ): Promise<any> {
    try {
      const clientId = this.configService.get<string>(
        'COGNITO_CLIENT_ID_USER_PASS',
      );
      const clientSecret = this.configService.get<string>(
        'CLIENT_SECRET_USER_PASS',
      );
      const secretHash = this.calculateSecretHash(
        username,
        clientId,
        clientSecret,
      );
      const command = new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: clientId,
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
          SECRET_HASH: secretHash,
        },
      });

      const response = await this.cognitoClient.send(command);
      return response;
    } catch (error) {
      throw new HttpException('Authentication failed', HttpStatus.UNAUTHORIZED);
    }
  }
}
