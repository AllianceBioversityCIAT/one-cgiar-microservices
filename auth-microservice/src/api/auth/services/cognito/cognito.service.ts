import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
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
import { UpdateUserDto } from '../../dto/update-user.dto';

@Injectable()
export class CognitoService {
  private readonly _logger = new Logger(CognitoService.name);
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
      const clientId = this.configService.get<string>('COGNITO_CLIENT_ID');
      const clientSecret = this.configService.get<string>(
        'COGNITO_CLIENT_SECRET',
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
      const clientId = this.configService.get<string>('COGNITO_CLIENT_ID');
      const clientSecret = this.configService.get<string>(
        'COGNITO_CLIENT_SECRET',
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
   * Stable microservice error codes for the EMAIL_OTP flow (OTP-R-7, OTP-R-11).
   * Never expose the raw Cognito `__type`/message to the caller.
   */
  private static readonly OTP_ERROR_COPY: Record<string, string> = {
    CODE_MISMATCH: 'Code incorrect. Try again.',
    CODE_EXPIRED: 'Code expired. Request a new one.',
    ATTEMPTS_EXCEEDED: 'Too many attempts. Request a new code.',
    NOT_AUTHORIZED: 'Not authorized.',
    CHALLENGE_NOT_SUPPORTED:
      'This sign-in option is not available for this account.',
    UPSTREAM_ERROR: 'We could not reach the sign-in service.',
  };

  /**
   * Pure mapping from a Cognito error shape (`__type`/`message`) to a stable
   * microservice error code. Never returns or forwards the raw Cognito text.
   * `CHALLENGE_NOT_SUPPORTED` is also used as an internal sentinel `__type`
   * so every OTP error path (Cognito exception or an unsupported challenge
   * in place of tokens) funnels through this one function.
   */
  private mapCognitoError(
    type: string,
    message: string,
  ):
    | 'CODE_MISMATCH'
    | 'CODE_EXPIRED'
    | 'ATTEMPTS_EXCEEDED'
    | 'NOT_AUTHORIZED'
    | 'CHALLENGE_NOT_SUPPORTED'
    | 'UPSTREAM_ERROR' {
    const msg = (message || '').toLowerCase();
    switch (type) {
      case 'CodeMismatchException':
        return 'CODE_MISMATCH';
      case 'ExpiredCodeException':
        return 'CODE_EXPIRED';
      case 'TooManyFailedAttemptsException':
        return 'ATTEMPTS_EXCEEDED';
      case 'NotAuthorizedException':
        if (msg.includes('session is expired')) return 'CODE_EXPIRED';
        if (msg.includes('attempt')) return 'ATTEMPTS_EXCEEDED';
        return 'NOT_AUTHORIZED';
      case 'CHALLENGE_NOT_SUPPORTED':
        return 'CHALLENGE_NOT_SUPPORTED';
      default:
        return 'UPSTREAM_ERROR';
    }
  }

  private otpException(type: string, message: string): HttpException {
    const code = this.mapCognitoError(type, message);
    const status =
      code === 'UPSTREAM_ERROR'
        ? HttpStatus.BAD_GATEWAY
        : HttpStatus.UNAUTHORIZED;
    return new HttpException(
      { code, message: CognitoService.OTP_ERROR_COPY[code] },
      status,
    );
  }

  private logOtpOutcome(
    event: 'otp.start' | 'otp.verify',
    outcome: string,
  ): void {
    this._logger.log(JSON.stringify({ event, outcome }));
  }

  /**
   * Start the EMAIL_OTP challenge (OTP-R-7, design.md §4.2/§5.2).
   * Mirrors loginWithCustomPassword's fetch/secret-hash pattern.
   */
  async startEmailOtp(username: string): Promise<{
    challengeName: 'EMAIL_OTP';
    session: string;
    codeDeliveryDestination?: string;
  }> {
    try {
      const clientId = this.configService.get<string>('COGNITO_CLIENT_ID');
      const clientSecret = this.configService.get<string>(
        'COGNITO_CLIENT_SECRET',
      );
      const secretHash = this.calculateSecretHash(
        username,
        clientId,
        clientSecret,
      );

      const initiateResponse = await fetch(
        this.configService.get<string>('COGNITO_USER_POOL_URL'),
        {
          method: 'POST',
          headers: {
            'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
            'Content-Type': 'application/x-amz-json-1.1',
          },
          body: JSON.stringify({
            AuthFlow: 'USER_AUTH',
            ClientId: clientId,
            AuthParameters: {
              USERNAME: username,
              SECRET_HASH: secretHash,
              PREFERRED_CHALLENGE: 'EMAIL_OTP',
            },
          }),
        },
      );
      const initiateResult = await initiateResponse.json();

      if (!initiateResponse.ok) {
        throw this.otpException(initiateResult.__type, initiateResult.message);
      }

      let challenge = initiateResult;

      if (challenge.ChallengeName === 'SELECT_CHALLENGE') {
        const availableChallenges: string[] =
          challenge.AvailableChallenges || [];
        if (!availableChallenges.includes('EMAIL_OTP')) {
          throw this.otpException('CHALLENGE_NOT_SUPPORTED', 'unsupported');
        }

        const selectResponse = await fetch(
          this.configService.get<string>('COGNITO_USER_POOL_URL'),
          {
            method: 'POST',
            headers: {
              'X-Amz-Target':
                'AWSCognitoIdentityProviderService.RespondToAuthChallenge',
              'Content-Type': 'application/x-amz-json-1.1',
            },
            body: JSON.stringify({
              ChallengeName: 'SELECT_CHALLENGE',
              ClientId: clientId,
              Session: challenge.Session,
              ChallengeResponses: {
                USERNAME: username,
                ANSWER: 'EMAIL_OTP',
                SECRET_HASH: secretHash,
              },
            }),
          },
        );
        const selectResult = await selectResponse.json();

        if (!selectResponse.ok) {
          throw this.otpException(selectResult.__type, selectResult.message);
        }

        challenge = selectResult;
      }

      if (challenge.ChallengeName !== 'EMAIL_OTP') {
        throw this.otpException('CHALLENGE_NOT_SUPPORTED', 'unsupported');
      }

      this.logOtpOutcome('otp.start', 'sent');
      return {
        challengeName: 'EMAIL_OTP',
        session: challenge.Session,
        codeDeliveryDestination:
          challenge.ChallengeParameters?.CODE_DELIVERY_DESTINATION,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        const response = error.getResponse() as { code?: string };
        this.logOtpOutcome('otp.start', response?.code || 'upstream_error');
        throw error;
      }
      this.logOtpOutcome('otp.start', 'upstream_error');
      throw this.otpException('UPSTREAM_ERROR', 'upstream error');
    }
  }

  /**
   * Verify an EMAIL_OTP code (OTP-R-7, design.md §4.2/§5.2).
   */
  async verifyEmailOtp(
    username: string,
    code: string,
    session: string,
  ): Promise<{
    tokens: {
      accessToken: string;
      idToken: string;
      refreshToken: string;
      expiresIn: number;
      tokenType: string;
    };
  }> {
    try {
      const clientId = this.configService.get<string>('COGNITO_CLIENT_ID');
      const clientSecret = this.configService.get<string>(
        'COGNITO_CLIENT_SECRET',
      );
      const secretHash = this.calculateSecretHash(
        username,
        clientId,
        clientSecret,
      );

      const response = await fetch(
        this.configService.get<string>('COGNITO_USER_POOL_URL'),
        {
          method: 'POST',
          headers: {
            'X-Amz-Target':
              'AWSCognitoIdentityProviderService.RespondToAuthChallenge',
            'Content-Type': 'application/x-amz-json-1.1',
          },
          body: JSON.stringify({
            ChallengeName: 'EMAIL_OTP',
            ClientId: clientId,
            Session: session,
            ChallengeResponses: {
              USERNAME: username,
              EMAIL_OTP_CODE: code,
              SECRET_HASH: secretHash,
            },
          }),
        },
      );
      const result = await response.json();

      if (!response.ok) {
        throw this.otpException(result.__type, result.message);
      }

      if (!result.AuthenticationResult) {
        throw this.otpException('CHALLENGE_NOT_SUPPORTED', 'unsupported');
      }

      this.logOtpOutcome('otp.verify', 'ok');
      return {
        tokens: {
          accessToken: result.AuthenticationResult.AccessToken,
          idToken: result.AuthenticationResult.IdToken,
          refreshToken: result.AuthenticationResult.RefreshToken,
          expiresIn: result.AuthenticationResult.ExpiresIn,
          tokenType: result.AuthenticationResult.TokenType,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        const response = error.getResponse() as { code?: string };
        this.logOtpOutcome('otp.verify', response?.code || 'upstream_error');
        throw error;
      }
      this.logOtpOutcome('otp.verify', 'upstream_error');
      throw this.otpException('UPSTREAM_ERROR', 'upstream error');
    }
  }

  /**
   * Provisioning adjustment (OTP-T-10, `OTP-R-13`, `OTP-AC-12`, design.md §13):
   * the spike showed a Cognito user holding a temporary password never
   * receives `EMAIL_OTP` (`SELECT_CHALLENGE [PASSWORD_SRP, PASSWORD]` only).
   * For emails whose domain is in `PASSWORDLESS_DOMAINS` (comma-separated,
   * matched case-insensitively, exact domain — no suffix match), `createUser`
   * skips `TemporaryPassword` so the user lands `CONFIRMED` and is eligible
   * for `EMAIL_OTP` directly. Empty/undefined env → feature off, every
   * domain keeps today's temporary-password flow.
   */
  isPasswordlessDomain(email: string): boolean {
    const domainsEnv = this.configService.get<string>('PASSWORDLESS_DOMAINS');
    if (!domainsEnv) {
      return false;
    }
    const domains = domainsEnv
      .split(',')
      .map((domain) => domain.trim().toLowerCase())
      .filter(Boolean);
    const emailDomain = (email || '').split('@')[1]?.toLowerCase();
    if (!emailDomain) {
      return false;
    }
    return domains.includes(emailDomain);
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
      const commandInput: Record<string, unknown> = {
        UserPoolId: this.configService.get<string>('COGNITO_USER_POOL_ID'),
        Username: username,
        TemporaryPassword: temporaryPassword,
        MessageAction: 'SUPPRESS',
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'given_name', Value: firstName },
          { Name: 'family_name', Value: lastName },
          { Name: 'email_verified', Value: 'true' },
        ],
      };

      if (this.isPasswordlessDomain(email)) {
        delete commandInput.TemporaryPassword;
      }

      const command = new AdminCreateUserCommand(commandInput as any);

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
      this._logger.error('Access token validation failed:', error);
      throw new HttpException('Invalid access token', HttpStatus.UNAUTHORIZED);
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
    userInfo: any,
    clientId: string,
    clientSecret: string,
  ): Promise<any> {
    try {
      const secretHash = this.calculateSecretHash(
        userInfo.username,
        clientId,
        clientSecret,
      );

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
      throw new Error(`Invalid token format`);
    }
  }
}
