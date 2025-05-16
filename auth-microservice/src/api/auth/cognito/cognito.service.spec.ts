import { Test, TestingModule } from '@nestjs/testing';
import { CognitoService } from './cognito.service';
import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import * as crypto from 'crypto';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';

global.fetch = jest.fn();

jest.mock('@aws-sdk/client-cognito-identity-provider', () => {
  const originalModule = jest.requireActual(
    '@aws-sdk/client-cognito-identity-provider',
  );

  return {
    ...originalModule,
    CognitoIdentityProviderClient: jest.fn().mockImplementation(() => ({
      send: jest.fn(),
    })),
  };
});

jest.mock('crypto', () => {
  return {
    createHmac: jest.fn().mockImplementation(() => ({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('mocked-hash-value'),
    })),
  };
});

describe('CognitoService', () => {
  let service: CognitoService;
  let configService: ConfigService;
  let cognitoClient: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CognitoService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const config = {
                AWS_REGION: 'us-east-1',
                AWS_ACCESS_KEY_ID: 'mock-access-key',
                AWS_SECRET_ACCESS_KEY: 'mock-secret-key',
                COGNITO_CLIENT_ID_USER: 'mock-client-id',
                COGNITO_CLIENT_SECRET_USER_PASS: 'mock-client-secret',
                COGNITO_USER_POOL_URL:
                  'https://cognito-idp.us-east-1.amazonaws.com/',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CognitoService>(CognitoService);
    configService = module.get<ConfigService>(ConfigService);
    cognitoClient = service['cognitoClient'];

    (global.fetch as jest.Mock).mockReset();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor', () => {
    it('should create a CognitoIdentityProviderClient with correct config', () => {
      expect(CognitoIdentityProviderClient).toHaveBeenCalledWith({
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'mock-access-key',
          secretAccessKey: 'mock-secret-key',
        },
      });
    });
  });


  describe('loginWithCustomPassword', () => {
    it('should call fetch with correct parameters', async () => {
      const username = 'test@example.com';
      const password = 'password123';
      const mockAuthResult = {
        AuthenticationResult: {
          AccessToken: 'mock-access-token',
          IdToken: 'mock-id-token',
          RefreshToken: 'mock-refresh-token',
          ExpiresIn: 3600,
          TokenType: 'Bearer',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockAuthResult),
      });

      const result = await service.loginWithCustomPassword(username, password);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://cognito-idp.us-east-1.amazonaws.com/',
        {
          method: 'POST',
          headers: {
            'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
            'Content-Type': 'application/x-amz-json-1.1',
          },
          body: JSON.stringify({
            AuthFlow: 'USER_PASSWORD_AUTH',
            ClientId: 'mock-client-id',
            AuthParameters: {
              USERNAME: username,
              PASSWORD: password,
              SECRET_HASH: 'mocked-hash-value',
            },
          }),
        },
      );

      expect(result).toEqual(mockAuthResult);
    });

    it('should use calculated secretHash in the auth parameters', async () => {
      const username = 'test@example.com';
      const password = 'password123';
      const clientId = 'mock-client-id';
      const clientSecret = 'mock-client-secret';
      const expectedSecretHash = 'calculated-secret-hash';

      const calculateSecretHashSpy = jest
        .spyOn<any, any>(service, 'calculateSecretHash')
        .mockReturnValue(expectedSecretHash);

      const mockAuthResult = {
        AuthenticationResult: {
          AccessToken: 'mock-access-token',
          IdToken: 'mock-id-token',
          RefreshToken: 'mock-refresh-token',
          ExpiresIn: 3600,
          TokenType: 'Bearer',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockAuthResult),
      });

      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        const config = {
          AWS_REGION: 'us-east-1',
          AWS_ACCESS_KEY_ID: 'mock-access-key',
          AWS_SECRET_ACCESS_KEY: 'mock-secret-key',
          COGNITO_CLIENT_ID_USER: clientId,
          COGNITO_CLIENT_SECRET_USER_PASS: clientSecret,
          COGNITO_USER_POOL_URL: 'https://cognito-idp.us-east-1.amazonaws.com/',
        };
        return config[key];
      });

      await service.loginWithCustomPassword(username, password);

      expect(calculateSecretHashSpy).toHaveBeenCalledWith(
        username,
        clientId,
        clientSecret,
      );

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining(expectedSecretHash),
        }),
      );
    });

    it('should throw exception when authentication fails', async () => {
      const username = 'test@example.com';
      const password = 'wrong-password';

      const errorResponse = {
        __type: 'NotAuthorizedException',
        message: 'Incorrect username or password.',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValueOnce(errorResponse),
      });

      await expect(
        service.loginWithCustomPassword(username, password),
      ).rejects.toThrow(HttpException);

      expect(global.fetch).toHaveBeenCalled();
    });
  });
});
