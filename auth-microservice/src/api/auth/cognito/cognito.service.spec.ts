import { Test, TestingModule } from '@nestjs/testing';
import { CognitoService } from './cognito.service';
import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  InitiateAuthCommandOutput,
} from '@aws-sdk/client-cognito-identity-provider';

jest.mock('@aws-sdk/client-cognito-identity-provider', () => {
  const originalModule = jest.requireActual(
    '@aws-sdk/client-cognito-identity-provider',
  );

  return {
    ...originalModule,
    CognitoIdentityProviderClient: jest.fn().mockImplementation(() => ({
      send: jest.fn(),
    })),
    InitiateAuthCommand: jest.fn(),
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

  describe('calculateSecretHash', () => {
    it('should calculate secret hash correctly', () => {
      const username = 'test@example.com';
      const clientId = 'mock-client-id';
      const clientSecret = 'mock-client-secret';

      // Get the real crypto module
      const realCrypto = jest.requireActual('crypto');

      // Calculate expected hash using real crypto
      const realHmac = realCrypto.createHmac('sha256', clientSecret);
      realHmac.update(username + clientId);
      const expectedHash = realHmac.digest('base64');

      // Temporarily use real crypto implementation
      jest
        .spyOn(crypto, 'createHmac')
        .mockImplementation((...args) => realCrypto.createHmac(...args));

      const calculateSecretHashResult = service['calculateSecretHash'](
        username,
        clientId,
        clientSecret,
      );

      // Restore the mock for other tests
      jest.spyOn(crypto, 'createHmac').mockImplementation(
        () =>
          ({
            update: jest.fn().mockReturnThis(),
            digest: jest.fn().mockReturnValue('mocked-hash-value'),
          }) as any,
      );

      expect(calculateSecretHashResult.length).toBeGreaterThan(0);
      expect(typeof calculateSecretHashResult).toBe('string');
      expect(calculateSecretHashResult).toBe(expectedHash);
    });

    it('should use the correct algorithm and encoding', () => {
      const username = 'test@example.com';
      const clientId = 'mock-client-id';
      const clientSecret = 'mock-client-secret';

      jest.spyOn(crypto, 'createHmac').mockRestore();
      const hmacSpy = jest.spyOn(crypto, 'createHmac');

      const mockDigest = jest.fn().mockReturnValue('base64-encoded-result');
      const mockUpdate = jest.fn().mockReturnThis();
      hmacSpy.mockReturnValue({
        update: mockUpdate,
        digest: mockDigest,
      } as any);

      service['calculateSecretHash'](username, clientId, clientSecret);

      expect(hmacSpy).toHaveBeenCalledWith('sha256', clientSecret);
      expect(mockUpdate).toHaveBeenCalledWith(username + clientId);
      expect(mockDigest).toHaveBeenCalledWith('base64');

      jest.spyOn(crypto, 'createHmac').mockImplementation(
        () =>
          ({
            update: jest.fn().mockReturnThis(),
            digest: jest.fn().mockReturnValue('mocked-hash-value'),
          }) as any,
      );
    });
  });

  describe('loginWithCustomPassword', () => {
    it('should call InitiateAuth with correct parameters', async () => {
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
        $metadata: {},
      };

      cognitoClient.send.mockResolvedValueOnce(mockAuthResult);

      const result = await service.loginWithCustomPassword(username, password);

      expect(InitiateAuthCommand).toHaveBeenCalledWith({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: 'mock-client-id',
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
          SECRET_HASH: 'mocked-hash-value',
        },
      });
      expect(cognitoClient.send).toHaveBeenCalled();
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
        $metadata: {},
      };

      cognitoClient.send.mockResolvedValueOnce(mockAuthResult);
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        const config = {
          AWS_REGION: 'us-east-1',
          AWS_ACCESS_KEY_ID: 'mock-access-key',
          AWS_SECRET_ACCESS_KEY: 'mock-secret-key',
          COGNITO_CLIENT_ID_USER: clientId,
          COGNITO_CLIENT_SECRET_USER_PASS: clientSecret,
        };
        return config[key];
      });

      await service.loginWithCustomPassword(username, password);

      expect(calculateSecretHashSpy).toHaveBeenCalledWith(
        username,
        clientId,
        clientSecret,
      );
      expect(InitiateAuthCommand).toHaveBeenCalledWith({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: clientId,
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
          SECRET_HASH: expectedSecretHash,
        },
      });
    });

    it('should throw exception when authentication fails', async () => {
      const username = 'test@example.com';
      const password = 'wrong-password';

      cognitoClient.send.mockRejectedValueOnce(
        new Error('NotAuthorizedException'),
      );

      await expect(
        service.loginWithCustomPassword(username, password),
      ).rejects.toThrow(HttpException);
      expect(cognitoClient.send).toHaveBeenCalled();
    });
  });
});
