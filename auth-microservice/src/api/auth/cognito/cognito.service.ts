import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import {
  AdminCreateUserCommand,
  AdminUpdateUserAttributesCommand,
  ChangePasswordCommand,
  CognitoIdentityProviderClient,
  GetUserCommand,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { UpdateUserDto } from '../dto/update-user.dto';

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
    const message = (username || '') + clientId;
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

      const result = await response.json();

      if (result.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
        return {
          challengeName: 'NEW_PASSWORD_REQUIRED',
          session: result.Session,
          userAttributes: JSON.parse(result.ChallengeParameters.userAttributes),
          userId: result.ChallengeParameters.USER_ID_FOR_SRP,
          message: 'Password change required. User must set a new password.',
        };
      }
      return result;
    } catch (error) {
      throw new HttpException(
        error.message || 'Authentication failed',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  /**
   * Complete NEW_PASSWORD_REQUIRED challenge
   * @param username Username
   * @param newPassword New password to set
   * @param session Session from the challenge
   * @returns Authentication result with tokens
   */
  async completeNewPasswordChallenge(
    username: string,
    newPassword: string,
    session: string,
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

      const command = new RespondToAuthChallengeCommand({
        ChallengeName: 'NEW_PASSWORD_REQUIRED',
        ClientId: clientId,
        ChallengeResponses: {
          USERNAME: username,
          NEW_PASSWORD: newPassword,
          SECRET_HASH: secretHash,
        },
        Session: session,
      });

      const response = await this.cognitoClient.send(command);
      return response;
    } catch (error) {
      throw new HttpException(
        error.message || 'Challenge response failed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Create a new user in Cognito User Pool
   * @param username Username
   * @param temporaryPassword Temporary password
   * @param firstName First name
   * @param lastName Last name
   * @param email Email address
   * @param sendEmail Whether to send welcome email
   * @returns User creation result
   */
  async createUser(
    username: string,
    temporaryPassword: string,
    firstName: string,
    lastName: string,
    email: string,
  ): Promise<any> {
    try {
      const command = new AdminCreateUserCommand({
        UserPoolId: this.configService.get<string>('COGNITO_USER_POOL_ID'),
        Username: username,
        TemporaryPassword: temporaryPassword,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'given_name', Value: firstName },
          { Name: 'family_name', Value: lastName },
          { Name: 'email_verified', Value: 'true' },
        ],
      });

      const response = await this.cognitoClient.send(command);

      return {
        userSub: response.User.Username,
        enabled: response.User.Enabled,
        userStatus: response.User.UserStatus,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'User creation failed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Update user attributes in Cognito
   * @param updateUserDto User update data
   */
  async updateUser(updateUserDto: UpdateUserDto): Promise<void> {
    try {
      const userAttributes = [];

      if (updateUserDto.firstName) {
        userAttributes.push({
          Name: 'given_name',
          Value: updateUserDto.firstName,
        });
      }
      if (updateUserDto.lastName) {
        userAttributes.push({
          Name: 'family_name',
          Value: updateUserDto.lastName,
        });
      }
      if (updateUserDto.email) {
        userAttributes.push({ Name: 'email', Value: updateUserDto.email });
        userAttributes.push({ Name: 'email_verified', Value: 'true' });
      }
      if (updateUserDto.phoneNumber) {
        userAttributes.push({
          Name: 'phone_number',
          Value: updateUserDto.phoneNumber,
        });
      }

      if (userAttributes.length === 0) {
        throw new HttpException(
          'No attributes to update',
          HttpStatus.BAD_REQUEST,
        );
      }

      const command = new AdminUpdateUserAttributesCommand({
        UserPoolId: this.configService.get<string>('COGNITO_USER_POOL_ID'),
        Username: updateUserDto.username,
        UserAttributes: userAttributes,
      });

      await this.cognitoClient.send(command);
    } catch (error) {
      throw new HttpException(
        error.message || 'User update failed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Change user password in Cognito
   * @param username Username
   * @param currentPassword Current password
   * @param newPassword New password
   * @param clientId Cognito client ID
   * @param clientSecret Cognito client secret
   */
  async changeUserPassword(
    username: string,
    currentPassword: string,
    newPassword: string,
    clientId: string,
    clientSecret: string,
  ): Promise<void> {
    try {
      const secretHash = this.calculateSecretHash(
        username,
        clientId,
        clientSecret,
      );

      const authCommand = new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: clientId,
        AuthParameters: {
          USERNAME: username,
          PASSWORD: currentPassword,
          SECRET_HASH: secretHash,
        },
      });
      console.log('🚀 ~ CognitoService ~ authCommand:', authCommand);

      const authResponse = await this.cognitoClient.send(authCommand);

      if (!authResponse.AuthenticationResult?.AccessToken) {
        throw new HttpException(
          'Current password is incorrect',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const changePasswordCommand = new ChangePasswordCommand({
        AccessToken: authResponse.AuthenticationResult.AccessToken,
        PreviousPassword: currentPassword,
        ProposedPassword: newPassword,
      });
      console.log(
        '🚀 ~ CognitoService ~ changePasswordCommand:',
        changePasswordCommand,
      );

      await this.cognitoClient.send(changePasswordCommand);
    } catch (error) {
      if (error.name === 'NotAuthorizedException') {
        throw new HttpException(
          'Current password is incorrect',
          HttpStatus.UNAUTHORIZED,
        );
      }
      throw new HttpException(
        error.message || 'Password change failed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Validate access token with Cognito
   * @param accessToken Access token to validate
   * @returns Token information if valid
   */
  async validateAccessToken(accessToken: string): Promise<any> {
    try {
      const command = new GetUserCommand({
        AccessToken: accessToken,
      });

      const response = await this.cognitoClient.send(command);

      const tokenPayload = this.decodeJwtToken(accessToken);

      return {
        username: response.Username,
        userAttributes: response.UserAttributes,
        exp: tokenPayload.exp,
        token_use: tokenPayload.token_use,
        client_id: tokenPayload.client_id,
      };
    } catch (error) {
      if (error.name === 'NotAuthorizedException') {
        throw new HttpException(
          'Access token has expired or is invalid',
          HttpStatus.UNAUTHORIZED,
        );
      }
      throw new HttpException(
        error.message || 'Token validation failed',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  /**
   * Refresh access token using refresh token
   * @param refreshToken Valid refresh token
   * @param clientId Cognito client ID
   * @param clientSecret Cognito client secret
   * @returns New tokens
   */
  async refreshAccessToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string,
  ): Promise<any> {
    try {
      const secretHash = this.calculateSecretHash('', clientId, clientSecret);

      const command = new InitiateAuthCommand({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: clientId,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
          SECRET_HASH: secretHash,
        },
      });

      const response = await this.cognitoClient.send(command);

      if (!response.AuthenticationResult) {
        throw new Error('No authentication result returned from Cognito');
      }

      return {
        accessToken: response.AuthenticationResult.AccessToken,
        idToken: response.AuthenticationResult.IdToken,
        refreshToken: response.AuthenticationResult.RefreshToken,
        expiresIn: response.AuthenticationResult.ExpiresIn,
        tokenType: response.AuthenticationResult.TokenType,
      };
    } catch (error) {
      if (error.name === 'NotAuthorizedException') {
        throw new HttpException(
          'Refresh token has expired or is invalid',
          HttpStatus.UNAUTHORIZED,
        );
      }

      throw new HttpException(
        'Refresh token is invalid or expired',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  /**
   * Decode JWT token to get payload information
   * @param token JWT token
   * @returns Decoded token payload
   */
  private decodeJwtToken(token: string): any {
    try {
      const base64Payload = token.split('.')[1];
      const payload = Buffer.from(base64Payload, 'base64').toString('utf8');
      return JSON.parse(payload);
    } catch (error) {
      console.error('Error decoding JWT token:', error);
      throw new Error('Invalid token format');
    }
  }
}
