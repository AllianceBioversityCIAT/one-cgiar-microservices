import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { MisService } from './mis.service';
import { of, throwError } from 'rxjs';
import { AxiosResponse, AxiosError } from 'axios';

describe('MisService', () => {
  let service: MisService;
  let httpService: HttpService;
  let configService: ConfigService;

  const mockHttpService = {
    get: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MisService,
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

    service = module.get<MisService>(MisService);
    httpService = module.get<HttpService>(HttpService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMisInfo', () => {
    const misId = '123';
    const clarisaEndpoint = 'https://clarisa.cgiar.org/api';
    const misInfoResponse = {
      id: 123,
      name: 'Test MIS',
      mis_auth: {
        cognito_client_id: 'test-client-id',
        cognito_client_secret: 'test-client-secret',
        auth_url: 'https://example.com/callback',
      },
    };

    it('should return MIS information when API call is successful', async () => {
      const axiosResponse: AxiosResponse = {
        data: misInfoResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockConfigService.get.mockReturnValue(clarisaEndpoint);
      mockHttpService.get.mockReturnValue(of(axiosResponse));

      const result = await service.getMisInfo(misId);

      expect(configService.get).toHaveBeenCalledWith('CLARISA_ENDPOINT');
      expect(httpService.get).toHaveBeenCalledWith(
        `${clarisaEndpoint}/mises/get/${misId}`,
      );
      expect(result).toEqual(misInfoResponse);
    });

    it('should throw NOT_FOUND exception when MIS does not exist', async () => {
      const error = {
        response: {
          status: 404,
          data: 'MIS not found',
        },
      };

      mockConfigService.get.mockReturnValue(clarisaEndpoint);
      mockHttpService.get.mockReturnValue(throwError(() => error));

      await expect(service.getMisInfo(misId)).rejects.toThrow(
        new HttpException('MIS not found', HttpStatus.NOT_FOUND),
      );
    });

    it('should throw INTERNAL_SERVER_ERROR exception when API call fails unexpectedly', async () => {
      mockConfigService.get.mockReturnValue(clarisaEndpoint);
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      await expect(service.getMisInfo(misId)).rejects.toThrow(
        new HttpException(
          'Error validating MIS ID',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });

    it('should throw NOT_FOUND exception when API returns 200 but no data', async () => {
      const axiosResponse: AxiosResponse = {
        data: null,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockConfigService.get.mockReturnValue(clarisaEndpoint);
      mockHttpService.get.mockReturnValue(of(axiosResponse));

      await expect(service.getMisInfo(misId)).rejects.toThrow(
        new HttpException('Error validating MIS ID', HttpStatus.NOT_FOUND),
      );
    });
  });
});
