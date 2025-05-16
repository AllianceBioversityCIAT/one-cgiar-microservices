import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ClarisaService, ResponseValidateClarisa } from './clarisa.service';
import { Clarisa } from './clarisa.connection';
import {
  MisConfigDto,
  ResClarisaCreateConectioDto,
  ResClarisaValidateConectioDto,
} from './dto/clarisa-create-conection.dto';
import { ResponseClarisaDto } from '../../shared/global-dto/response-clarisa.dto';
import { Logger } from '@nestjs/common';
import { MisMetadataDto } from './dto/mis-medatada.dto';
import { ConfigService } from '@nestjs/config';

jest.mock('./clarisa.connection');

describe('ClarisaService', () => {
  let service: ClarisaService;
  let httpService: HttpService;
  let configService: ConfigService;
  let mockClarisa: jest.Mocked<Clarisa>;

  const mockHttpService = {
    post: jest.fn(),
    get: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const configs = {
        CLARISA_MIS: 'AUTH',
        CLARISA_MIS_ENV: 'Testing',
        CLARISA_LOGIN: 'test-login',
        CLARISA_PASSWORD: 'test-password',
      };
      return configs[key];
    }),
  };

  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    jest.spyOn(Logger.prototype, 'log').mockImplementation(mockLogger.log);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(mockLogger.error);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(mockLogger.debug);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClarisaService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ClarisaService>(ClarisaService);
    httpService = module.get<HttpService>(HttpService);
    configService = module.get<ConfigService>(ConfigService);

    mockClarisa = service['connection'] as unknown as jest.Mocked<Clarisa>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor', () => {
    it('should initialize with correct settings', () => {
      expect(service['misSettings']).toEqual({
        acronym: 'AUTH',
        environment: 'Testing',
      });

      expect(Clarisa).toHaveBeenCalledWith(
        httpService,
        {
          login: 'test-login',
          password: 'test-password',
        },
        configService,
      );

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('CLARISA service initialized for MIS'),
      );
    });
  });

  describe('authorization', () => {
    it('should return valid result with metadata for successful validation', async () => {
      const clientId = 'test-client-id';
      const clientSecret = 'test-client-secret';

      const validationResponse: ResponseClarisaDto<ResClarisaValidateConectioDto> =
        {
          message: 'Success',
          status: 200,
          response: {
            client_id: clientId,
            sender_mis: {
              id: 123,
              name: 'Test MIS',
              acronym: 'TST',
              environment: 'DEV',
            },
            receiver_mis: {
              id: 456,
              name: 'Auth Microservice',
              acronym: 'AUTH',
              environment: 'TEST',
            },
          },
        };

      const formattedValidationResponse: ResponseValidateClarisa<ResClarisaValidateConectioDto> =
        {
          valid: true,
          data: validationResponse.response,
        };

      const misMetadataResponse: MisMetadataDto = {
        id: 123,
        name: 'Test MIS',
        acronym: 'TST',
        main_contact_point_id: 456,
        environment_id: 1,
        mis_auth: {
          id: 1,
          mis_id: 123,
          auth_url: 'https://example.com/callback',
          cognito_client_id: 'test-cognito-id',
          cognito_client_secret: 'test-cognito-secret',
        },
      };

      mockClarisa.post.mockResolvedValueOnce(validationResponse);
      mockClarisa.get.mockResolvedValueOnce(misMetadataResponse);

      jest
        .spyOn(service, 'formatValid')
        .mockReturnValueOnce(formattedValidationResponse);

      const result = await service.authorization(clientId, clientSecret);

      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();

      const data = result.data as any;
      expect(data.client_id).toBe(clientId);
      expect(data.sender_mis.id).toBe(123);
      expect(data.sender_mis_metadata).toBeDefined();
      expect(data.sender_mis_metadata.mis_auth).toBeDefined();

      expect(mockClarisa.post).toHaveBeenCalledWith('app-secrets/validate', {
        client_id: clientId,
        secret: clientSecret,
      });

      expect(mockClarisa.get).toHaveBeenCalledWith('mises/get-metadata/123');
      expect(service.formatValid).toHaveBeenCalledWith(validationResponse);
    });

    it('should return invalid result when validation fails', async () => {
      const clientId = 'invalid-id';
      const clientSecret = 'invalid-secret';

      const errorResponse: ResponseClarisaDto<null> = {
        message: 'Invalid credentials',
        status: 401,
        response: null,
      };

      const formattedErrorResponse: ResponseValidateClarisa<null> = {
        valid: false,
        data: null,
      };

      mockClarisa.post.mockResolvedValueOnce(errorResponse);
      jest
        .spyOn(service, 'formatValid')
        .mockReturnValueOnce(formattedErrorResponse);

      const result = await service.authorization(clientId, clientSecret);

      expect(result.valid).toBe(false);
      expect(result.data).toBeNull();
    });

    it('should return invalid result when MIS metadata is missing', async () => {
      const clientId = 'test-client-id';
      const clientSecret = 'test-client-secret';

      const validationResponse: ResponseClarisaDto<ResClarisaValidateConectioDto> =
        {
          message: 'Success',
          status: 200,
          response: {
            client_id: clientId,
            sender_mis: {
              id: 123,
              name: 'Test MIS',
              acronym: 'TST',
              environment: 'DEV',
            },
            receiver_mis: {
              id: 456,
              name: 'Auth Microservice',
              acronym: 'AUTH',
              environment: 'TEST',
            },
          },
        };

      const formattedValidationResponse: ResponseValidateClarisa<ResClarisaValidateConectioDto> =
        {
          valid: true,
          data: validationResponse.response,
        };

      mockClarisa.post.mockResolvedValueOnce(validationResponse);
      mockClarisa.get.mockResolvedValueOnce(null);
      jest
        .spyOn(service, 'formatValid')
        .mockReturnValueOnce(formattedValidationResponse);

      const result = await service.authorization(clientId, clientSecret);

      expect(result.valid).toBe(false);
      expect(result.data).toBeNull();
      expect(mockLogger.error).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('Failed to get metadata for MIS ID'),
      );
    });

    it('should handle unexpected errors during authorization process', async () => {
      const clientId = 'test-client-id';
      const clientSecret = 'test-client-secret';

      mockClarisa.post.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.authorization(clientId, clientSecret);

      expect(result.valid).toBe(false);
      expect(result.data).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error authorizing client ID'),
        expect.anything(),
      );
    });
  });

  describe('getMisMetadata', () => {
    it('should return metadata when MIS exists', async () => {
      const misId = 123;

      const misMetadataResponse: MisMetadataDto = {
        id: 123,
        name: 'Test MIS',
        acronym: 'TST',
        main_contact_point_id: 456,
        environment_id: 1,
        mis_auth: {
          id: 1,
          mis_id: 123,
          auth_url: 'https://example.com/callback',
          cognito_client_id: 'test-cognito-id',
          cognito_client_secret: 'test-cognito-secret',
        },
      };

      mockClarisa.get.mockResolvedValueOnce(misMetadataResponse);

      const result = await service.getMisMetadata(misId);

      expect(result).toEqual(misMetadataResponse);
      expect(mockClarisa.get).toHaveBeenCalledWith(
        `mises/get-metadata/${misId}`,
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        `Getting MIS metadata for ID: ${misId}`,
      );
    });

    it('should handle error when getting MIS metadata', async () => {
      const misId = 999;

      mockClarisa.get.mockRejectedValueOnce(new Error('MIS not found'));

      await expect(service.getMisMetadata(misId)).resolves.toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error getting MIS metadata for ID: ${misId}`,
        expect.anything(),
      );
    });
  });

  describe('createConnection', () => {
    it('should create a connection between two MISes', async () => {
      const senderMis: MisConfigDto = {
        acronym: 'SENDER',
        environment: 'Production',
      };

      const createConnectionResponse: ResponseClarisaDto<ResClarisaCreateConectioDto> =
        {
          message: 'Connection created',
          status: 201,
          response: {
            client_id: 'new-client-id',
            secret: 'new-client-secret',
            sender_mis: {
              id: 123,
              name: 'Sender MIS',
              acronym: 'SENDER',
              environment: 'Production',
            },
            receiver_mis: {
              id: 456,
              name: 'Auth Microservice',
              acronym: 'AUTH',
              environment: 'Testing',
            },
          },
        };

      const formattedResponse: ResponseValidateClarisa<ResClarisaCreateConectioDto> =
        {
          valid: true,
          data: createConnectionResponse.response,
        };

      mockClarisa.post.mockResolvedValueOnce(createConnectionResponse);
      jest.spyOn(service, 'formatValid').mockReturnValueOnce(formattedResponse);

      const result = await service.createConnection(senderMis);

      expect(result).toEqual(createConnectionResponse.response);
      expect(mockClarisa.post).toHaveBeenCalledWith('app-secrets/create', {
        receiver_mis: {
          acronym: 'AUTH',
          environment: 'Testing',
        },
        sender_mis: senderMis,
      });
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Creating connection for sender MIS'),
      );
    });

    it('should handle errors when creating connection', async () => {
      const senderMis: MisConfigDto = {
        acronym: 'SENDER',
        environment: 'Production',
      };

      mockClarisa.post.mockRejectedValueOnce(
        new Error('Error creating connection'),
      );

      try {
        await service.createConnection(senderMis);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('formatValid', () => {
    it('should format successful response correctly', () => {
      const mockResponse: ResponseClarisaDto<string> = {
        message: 'Success',
        status: 200,
        response: 'Test response',
      };

      const result: ResponseValidateClarisa<string> =
        service.formatValid(mockResponse);

      expect(result).toEqual({
        data: 'Test response',
        valid: true,
      });
    });

    it('should format error response correctly', () => {
      const mockResponse: ResponseClarisaDto<null> = {
        message: 'Error',
        status: 400,
        response: null,
      };

      const result: ResponseValidateClarisa<null> =
        service.formatValid(mockResponse);

      expect(result).toEqual({
        data: null,
        valid: false,
      });
    });

    it('should handle 2xx status codes as valid', () => {
      const mockResponse: ResponseClarisaDto<string> = {
        message: 'Created',
        status: 201,
        response: 'Created resource',
      };

      const result: ResponseValidateClarisa<string> =
        service.formatValid(mockResponse);

      expect(result.valid).toBe(true);
      expect(result.data).toBe('Created resource');
    });
  });
});
