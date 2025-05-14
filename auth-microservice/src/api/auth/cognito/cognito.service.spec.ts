import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { CognitoService } from './cognito.service';
import { ConfigService } from '@nestjs/config';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  AdminInitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';

jest.mock('@aws-sdk/client-cognito-identity-provider', () => {
  return {
    CognitoIdentityProviderClient: jest.fn().mockImplementation(() => {
      return {
        send: jest.fn(),
      };
    }),
    InitiateAuthCommand: jest.fn(),
    AdminInitiateAuthCommand: jest.fn(),
  };
});

describe('CognitoService', () => {
  let service: CognitoService;
  let configService: ConfigService;
  let mockCognitoClient: jest.Mocked<CognitoIdentityProviderClient>;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const configs = {
        AWS_REGION: 'us-east-1',
        AWS_ACCESS_KEY_ID: 'test-access-key',
        AWS_SECRET_ACCESS_KEY: 'test-secret-key',
        COGNITO_CLIENT_ID_AD: 'test-client-id-ad',
        CLIENT_SECRET_AD: 'test-client-secret-ad',
        COGNITO_USER_POOL_ID: 'test-user-pool-id',
        COGNITO_CLIENT_ID_USER_PASS: 'test-client-id-user-pass',
        CLIENT_SECRET_USER_PASS: 'test-client-secret-user-pass',
      };
      return configs[key];
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CognitoService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<CognitoService>(CognitoService);
    configService = module.get<ConfigService>(ConfigService);
    mockCognitoClient = service[
      'cognitoClient'
    ] as jest.Mocked<CognitoIdentityProviderClient>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('init', () => {
    it('should initialize the Cognito client with the correct configuration', () => {
      expect(CognitoIdentityProviderClient).toHaveBeenCalledWith({
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
        },
      });
    });
  });

  describe('loginWithAzureAD', () => {
    it('should call Cognito AdminInitiateAuthCommand with correct parameters', async () => {
      const username = 'test-user';
      const password = 'test-password';
      const mockResponse = {
        AuthenticationResult: {
          AccessToken: 'test-access-token',
          IdToken: 'test-id-token',
          RefreshToken: 'test-refresh-token',
          ExpiresIn: 3600,
          TokenType: 'Bearer',
        },
      };

      mockCognitoClient.send.mockResolvedValue(mockResponse as never);

      const result = await service.loginWithAzureAD(username, password);

      expect(AdminInitiateAuthCommand).toHaveBeenCalledWith({
        UserPoolId: 'test-user-pool-id',
        ClientId: 'test-client-id-ad',
        AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
          SECRET_HASH: expect.any(String),
        },
      });

      expect(mockCognitoClient.send).toHaveBeenCalled();
      expect(result).toEqual(mockResponse);
    });

    it('should throw an error when Cognito authentication fails', async () => {
      const username = 'test-user';
      const password = 'wrong-password';

      mockCognitoClient.send.mockRejectedValue(
        new Error('NotAuthorizedException') as never,
      );

      await expect(
        service.loginWithAzureAD(username, password),
      ).rejects.toThrow(
        new HttpException('Authentication failed', HttpStatus.UNAUTHORIZED),
      );
    });
  });

  describe('loginWithCustomPassword', () => {
    it('should call Cognito InitiateAuthCommand with correct parameters', async () => {
      const username = 'test-user';
      const password = 'test-password';
      const mockResponse = {
        AuthenticationResult: {
          AccessToken: 'test-access-token',
          IdToken: 'test-id-token',
          RefreshToken: 'test-refresh-token',
          ExpiresIn: 3600,
          TokenType: 'Bearer',
        },
      };

      mockCognitoClient.send.mockResolvedValue(mockResponse as never);

      const result = await service.loginWithCustomPassword(username, password);

      expect(InitiateAuthCommand).toHaveBeenCalledWith({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: 'test-client-id-user-pass',
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
          SECRET_HASH: expect.any(String),
        },
      });

      expect(mockCognitoClient.send).toHaveBeenCalled();
      expect(result).toEqual(mockResponse);
    });

    it('should throw an error when Cognito authentication fails', async () => {
      const username = 'test-user';
      const password = 'wrong-password';

      mockCognitoClient.send.mockRejectedValue(
        new Error('NotAuthorizedException') as never,
      );

      await expect(
        service.loginWithCustomPassword(username, password),
      ).rejects.toThrow(
        new HttpException('Authentication failed', HttpStatus.UNAUTHORIZED),
      );
    });
  });

  describe('calculateSecretHash', () => {
    it('should correctly calculate the secret hash', () => {
      const username = 'test-user';
      const clientId = 'test-client-id';
      const clientSecret = 'test-client-secret';

      const secretHash = service['calculateSecretHash'](
        username,
        clientId,
        clientSecret,
      );

      expect(typeof secretHash).toBe('string');
      expect(secretHash).toMatch(/^[A-Za-z0-9+/=]+$/);
    });
  });
});
