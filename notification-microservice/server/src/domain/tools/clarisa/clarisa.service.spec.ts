import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { ClarisaService } from './clarisa.service';
import { AxiosRequestHeaders } from 'axios';

describe('ClarisaService', () => {
  let service: ClarisaService;
  let httpService: HttpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClarisaService,
        {
          provide: HttpService,
          useValue: {
            post: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ClarisaService>(ClarisaService);
    httpService = module.get<HttpService>(HttpService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('authorization', () => {
    it('should throw BadRequestException for invalid credentials', async () => {
      jest.spyOn(httpService, 'post').mockReturnValue(
        of({
          data: {
            receiver_mis: {
              acronym: process.env.MS_CLARISA_MIS,
              environment: process.env.MS_CLARISA_MIS_ENV,
            },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {
            headers: {} as AxiosRequestHeaders,
          },
        }),
      );

      expect(await service.authorization('clientId', 'clientSecret')).toEqual({
        data: null,
        valid: false,
      });
    });

    it('should return valid response for correct credentials', async () => {
      process.env.MS_CLARISA_MIS = 'SELFTEST';
      process.env.MS_CLARISA_MIS_ENV = 'TEST';
      jest.spyOn(httpService, 'post').mockReturnValue(
        of({
          data: {
            response: {
              receiver_mis: {
                acronym: process.env.MS_CLARISA_MIS,
                environment: process.env.MS_CLARISA_MIS_ENV,
              },
            },
            status: 200,
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {
            headers: {} as AxiosRequestHeaders,
          },
        }),
      );

      const result = await service.authorization('clientId', 'clientSecret');
      expect(result.valid).toBeTruthy();
    });
  });
});
