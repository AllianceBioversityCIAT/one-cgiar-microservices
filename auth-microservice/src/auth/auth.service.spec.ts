import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { MisService } from './mis/mis.service';
import { CognitoService } from './cognito/cognito.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';

describe('AuthService', () => {
  let service: AuthService;
  let misService: MisService;
  let configService: ConfigService;
  let httpService: HttpService;

  const mockMisService = {
    getMisInfo: jest.fn(),
  };

  const mockCognitoService = {
    loginWithAzureAD: jest.fn(),
    loginWithCustomPassword: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockHttpService = {
    post: jest.fn(),
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: MisService, useValue: mockMisService },
        { provide: CognitoService, useValue: mockCognitoService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: HttpService, useValue: mockHttpService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    misService = module.get<MisService>(MisService);
    configService = module.get<ConfigService>(ConfigService);
    httpService = module.get<HttpService>(HttpService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('authenticateWithProvider', () => {
    const providerAuthDto = {
      misId: '123',
      provider: 'Azure-AD',
    };

    const misInfo = {
      id: 123,
      name: 'Test MIS',
      mis_auth: {
        cognito_client_id: 'test-client-id',
        cognito_client_secret: 'test-client-secret',
        auth_url: 'https://example.com/callback',
      },
    };

    it('should return an auth URL when MIS is valid', async () => {
      mockMisService.getMisInfo.mockResolvedValue(misInfo);
      mockConfigService.get.mockReturnValue('https://cognito-domain.com');

      const result = await service.authenticateWithProvider(providerAuthDto);

      expect(result).toHaveProperty('authUrl');
      expect(result.authUrl).toContain(
        'https://cognito-domain.com/oauth2/authorize',
      );
      expect(result.authUrl).toContain('client_id=test-client-id');
      expect(result.authUrl).toContain(
        'redirect_uri=https://example.com/callback',
      );
      expect(result.authUrl).toContain('identity_provider=Azure-AD');
      expect(misService.getMisInfo).toHaveBeenCalledWith('123');
      expect(configService.get).toHaveBeenCalledWith('COGNITO_URL');
    });

    it('should throw an exception when MIS authentication information is not found', async () => {
      mockMisService.getMisInfo.mockResolvedValue({
        id: 123,
        name: 'Test MIS',
      });

      await expect(
        service.authenticateWithProvider(providerAuthDto),
      ).rejects.toThrow(
        new HttpException(
          'MIS authentication information not found',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should throw an exception when MIS service throws an error', async () => {
      mockMisService.getMisInfo.mockRejectedValue(new Error('Database error'));

      await expect(
        service.authenticateWithProvider(providerAuthDto),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('validateAuthorizationCode', () => {
    const validateCodeDto = {
      misId: '123',
      code: 'test-auth-code',
    };

    const misInfo = {
      id: 123,
      name: 'Test MIS',
      mis_auth: {
        cognito_client_id: 'test-client-id',
        cognito_client_secret: 'test-client-secret',
        auth_url: 'https://example.com/callback',
      },
    };

    const tokenResponse: AxiosResponse = {
      data: {
        access_token: 'test-access-token',
        id_token: 'test-id-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should return tokens when code is valid', async () => {
      mockMisService.getMisInfo.mockResolvedValue(misInfo);
      mockConfigService.get.mockReturnValue('https://cognito-domain.com');
      mockHttpService.post.mockReturnValue(of(tokenResponse));

      const result = await service.validateAuthorizationCode(validateCodeDto);

      expect(result).toEqual({
        accessToken: 'test-access-token',
        idToken: 'test-id-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 3600,
        tokenType: 'Bearer',
      });

      expect(misService.getMisInfo).toHaveBeenCalledWith('123');
      expect(configService.get).toHaveBeenCalledWith('COGNITO_URL');
      expect(httpService.post).toHaveBeenCalled();
    });

    it('should throw an exception when MIS service throws an error', async () => {
      mockMisService.getMisInfo.mockRejectedValue(new Error('Database error'));

      await expect(
        service.validateAuthorizationCode(validateCodeDto),
      ).rejects.toThrow(HttpException);
    });
  });
});
