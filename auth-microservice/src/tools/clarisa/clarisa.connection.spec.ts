import { HttpService } from '@nestjs/axios';
import { Clarisa, ClarisaOptions, JwtClarisa } from './clarisa.connection';
import { of, throwError } from 'rxjs';
import { BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { decode } from 'jsonwebtoken';

jest.mock('jsonwebtoken', () => ({
  decode: jest.fn(),
}));

describe('Clarisa Connection', () => {
  let clarisa: Clarisa;
  let httpService: HttpService;
  let configService: ConfigService;

  const mockHttpService = {
    post: jest.fn(),
    get: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const clarisaOptions: ClarisaOptions = {
    login: 'test-login',
    password: 'test-password',
  };

  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    jest.spyOn(Logger.prototype, 'log').mockImplementation(mockLogger.log);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(mockLogger.error);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(mockLogger.debug);

    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'CLARISA_HOST') return 'https://example.com/';
      return undefined;
    });

    httpService = mockHttpService as unknown as HttpService;
    configService = mockConfigService as unknown as ConfigService;
    clarisa = new Clarisa(httpService, clarisaOptions, configService);
  });

  describe('constructor', () => {
    it('should initialize with correct values', () => {
      expect(clarisa['clarisaHost']).toBe('https://example.com/api/');
      expect(clarisa['authBody']).toEqual(clarisaOptions);
      expect(clarisa['http']).toBe(httpService);
      expect(clarisa['configService']).toBe(configService);

      expect(mockConfigService.get).toHaveBeenCalledWith('CLARISA_HOST');
    });
  });

  describe('getToken', () => {
    it('should get a new token when no token exists', async () => {
      const mockToken = 'mock-jwt-token';
      mockHttpService.post.mockReturnValue(
        of({
          data: {
            access_token: mockToken,
          },
        }),
      );

      const token = await (clarisa as any).getToken();

      expect(mockHttpService.post).toHaveBeenCalledWith(
        'https://example.com/auth/login',
        clarisaOptions,
      );
      expect(token).toBe(mockToken);
      expect(mockLogger.log).toHaveBeenCalledWith('Getting new CLARISA token');
      expect(mockLogger.log).toHaveBeenCalledWith(
        'CLARISA token obtained successfully',
      );
    });

    it('should get a new token when current token is invalid', async () => {
      (clarisa as any).token = 'expired-token';

      jest.spyOn(clarisa as any, 'validToken').mockReturnValue(false);

      const mockToken = 'new-jwt-token';
      mockHttpService.post.mockReturnValue(
        of({
          data: {
            access_token: mockToken,
          },
        }),
      );

      const token = await (clarisa as any).getToken();

      expect(mockHttpService.post).toHaveBeenCalledWith(
        'https://example.com/auth/login',
        clarisaOptions,
      );
      expect(token).toBe(mockToken);
      expect(clarisa['validToken']).toHaveBeenCalledWith('expired-token');
    });

    it('should use existing token if valid', async () => {
      const existingToken = 'valid-token';
      (clarisa as any).token = existingToken;

      jest.spyOn(clarisa as any, 'validToken').mockReturnValue(true);

      const token = await (clarisa as any).getToken();

      expect(mockHttpService.post).not.toHaveBeenCalled();
      expect(token).toBe(existingToken);
      expect(clarisa['validToken']).toHaveBeenCalledWith(existingToken);
    });

    it('should handle error when getting token', async () => {
      mockHttpService.post.mockReturnValue(
        throwError(() => new Error('Auth failed')),
      );

      await expect((clarisa as any).getToken()).rejects.toThrow(
        BadRequestException,
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error getting CLARISA token',
        expect.anything(),
      );
    });
  });

  describe('validToken', () => {
    it('should return true for valid token', () => {
      const mockDecodedToken: JwtClarisa = {
        exp: Math.floor(Date.now() / 1000) + 3600,
        login: 'test-login',
        sub: 123,
        permissions: [],
        iat: Math.floor(Date.now() / 1000),
      };

      (decode as jest.Mock).mockReturnValue(mockDecodedToken);

      const result = (clarisa as any).validToken('valid-token');

      expect(result).toBe(true);
      expect(decode).toHaveBeenCalledWith('valid-token');
    });

    it('should return false for expired token', () => {
      const mockDecodedToken: JwtClarisa = {
        exp: Math.floor(Date.now() / 1000) - 3600,
        login: 'test-login',
        sub: 123,
        permissions: [],
        iat: Math.floor(Date.now() / 1000) - 7200,
      };

      (decode as jest.Mock).mockReturnValue(mockDecodedToken);

      const result = (clarisa as any).validToken('expired-token');

      expect(result).toBe(false);
      expect(decode).toHaveBeenCalledWith('expired-token');
    });

    it('should return false for invalid token', () => {
      (decode as jest.Mock).mockReturnValue(null);

      const result = (clarisa as any).validToken('invalid-token');

      expect(result).toBe(false);
      expect(decode).toHaveBeenCalledWith('invalid-token');
    });

    it('should return false if token does not have exp claim', () => {
      const mockDecodedToken = {
        login: 'test-login',
        sub: 123,
        permissions: [],
        iat: Math.floor(Date.now() / 1000),
      };

      (decode as jest.Mock).mockReturnValue(mockDecodedToken);

      const result = (clarisa as any).validToken('incomplete-token');

      expect(result).toBe(false);
      expect(decode).toHaveBeenCalledWith('incomplete-token');
    });

    it('should handle error during token validation', () => {
      (decode as jest.Mock).mockImplementation(() => {
        throw new Error('Decode error');
      });

      const result = (clarisa as any).validToken('problematic-token');

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error validating CLARISA token',
        expect.anything(),
      );
    });
  });

  describe('post', () => {
    it('should make a POST request with correct parameters', async () => {
      const mockToken = 'mock-jwt-token';
      jest.spyOn(clarisa as any, 'getToken').mockResolvedValue(mockToken);

      const path = 'test/path';
      const data = { test: 'data' };
      const mockResponse = { result: 'success' };

      mockHttpService.post.mockReturnValue(
        of({
          data: mockResponse,
        }),
      );

      const result = await clarisa.post(path, data);

      expect(clarisa['getToken']).toHaveBeenCalled();
      expect(mockHttpService.post).toHaveBeenCalledWith(
        'https://example.com/api/test/path',
        data,
        {
          headers: {
            Authorization: `Bearer ${mockToken}`,
          },
        },
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('get', () => {
    it('should make a GET request with correct parameters', async () => {
      const mockToken = 'mock-jwt-token';
      jest.spyOn(clarisa as any, 'getToken').mockResolvedValue(mockToken);

      const path = 'test/path';
      const mockResponse = { result: 'success' };

      mockHttpService.get.mockReturnValue(
        of({
          data: mockResponse,
        }),
      );

      const result = await clarisa.get(path);

      expect(clarisa['getToken']).toHaveBeenCalled();
      expect(mockHttpService.get).toHaveBeenCalledWith(
        'https://example.com/api/test/path',
        {
          headers: {
            Authorization: `Bearer ${mockToken}`,
          },
        },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle error in GET request', async () => {
      const mockToken = 'mock-jwt-token';
      jest.spyOn(clarisa as any, 'getToken').mockResolvedValue(mockToken);

      const path = 'test/path';

      mockHttpService.get.mockReturnValue(
        throwError(() => new BadRequestException('Request failed')),
      );

      await expect(clarisa.get(path)).rejects.toThrow(BadRequestException);
    });
  });
});
