import { ConfigService } from '@nestjs/config';
import { ClarisaService } from './clarisa.service';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { MisConfigDto } from './dto/clarisa-create-conection.dto';

const validToken =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjk5OTk5OTk5OTl9.x';

describe('ClarisaService', () => {
  let service: ClarisaService;
  let httpService: jest.Mocked<HttpService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    httpService = {
      post: jest.fn(),
    } as unknown as jest.Mocked<HttpService>;

    configService = {
      get: jest.fn((key: string) => {
        const map: Record<string, string> = {
          CLARISA_MIS: 'MIS',
          CLARISA_MIS_ENV: 'dev',
          CLARISA_LOGIN: 'login',
          CLARISA_PASSWORD: 'pass',
          CLARISA_HOST: 'https://clarisa.example.com/',
        };
        return map[key] ?? '';
      }),
    } as unknown as jest.Mocked<ConfigService>;

    service = new ClarisaService(httpService, configService);
  });

  describe('authorization', () => {
    it('should return valid when API returns 2xx', async () => {
      (httpService.post as jest.Mock)
        .mockReturnValueOnce(of({ data: { access_token: validToken } }))
        .mockReturnValueOnce(
          of({
            data: {
              status: 200,
              response: {
                client_id: 'c',
                sender_mis: {},
                receiver_mis: {},
              },
            },
          }),
        );

      const result = await service.authorization('user', 'secret');

      expect(httpService.post).toHaveBeenCalled();
      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should return invalid when API returns non-2xx', async () => {
      (httpService.post as jest.Mock)
        .mockReturnValueOnce(of({ data: { access_token: validToken } }))
        .mockReturnValueOnce(of({ data: { status: 401, response: null } }));

      const result = await service.authorization('user', 'secret');

      expect(result.valid).toBe(false);
      expect(result.data).toBeNull();
    });

    it('should return invalid when request fails', async () => {
      (httpService.post as jest.Mock).mockReturnValueOnce(
        throwError(() => new Error('Network error')),
      );

      const result = await service.authorization('user', 'secret');

      expect(result.valid).toBe(false);
    });
  });

  describe('createConnection', () => {
    it('should post app-secrets/create and return formatted data', async () => {
      const mis: MisConfigDto = { acronym: 'APP', environment: 'dev' };
      const responseData = {
        client_id: 'c',
        sender_mis: {
          acronym: 'APP',
          environment: 'dev',
          code: 1,
          name: 'App',
        },
        receiver_mis: {
          acronym: 'MIS',
          environment: 'dev',
          code: 2,
          name: 'Mis',
        },
        secret: 's',
      };
      (httpService.post as jest.Mock)
        .mockReturnValueOnce(of({ data: { access_token: validToken } }))
        .mockReturnValueOnce(
          of({
            data: {
              status: 200,
              response: responseData,
            },
          }),
        );

      const result = await service.createConnection(mis);

      expect(httpService.post).toHaveBeenCalled();
      expect(result).toEqual(responseData);
    });
  });

  describe('validateApiKey', () => {
    it('should return valid true and mapped data when API returns valid: true', async () => {
      (httpService.post as jest.Mock).mockReturnValueOnce(
        of({
          data: {
            valid: true,
            mis: { id: 5, name: 'Reporting Tool', acronym: 'PRMS' },
            environment: 'PROD',
            scopes: ['reports:generate'],
          },
        }),
      );

      const result = await service.validateApiKey(
        'cl_prod_1234567890123456789012345678901234567890',
        '/api/reports/pdf/generate',
        '127.0.0.1',
      );

      expect(httpService.post).toHaveBeenCalled();
      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.receiver_mis.acronym).toBe('PRMS');
      expect(result.data.client_id).toBe('cl_prod_12345678');
    });

    it('should return valid false when API returns valid: false', async () => {
      (httpService.post as jest.Mock).mockReturnValueOnce(
        of({
          data: {
            valid: false,
            error: 'Invalid API key',
          },
        }),
      );

      const result = await service.validateApiKey(
        'cl_prod_invalid',
        '/api/reports/pdf/generate',
      );

      expect(result.valid).toBe(false);
      expect(result.data).toBeNull();
    });

    it('should return valid false when request fails', async () => {
      (httpService.post as jest.Mock).mockReturnValueOnce(
        throwError(() => new Error('HTTP 401')),
      );

      const result = await service.validateApiKey(
        'cl_prod_invalid',
        '/api/reports/pdf/generate',
      );

      expect(result.valid).toBe(false);
      expect(result.data).toBeNull();
    });
  });

  describe('formatValid', () => {
    it('should return valid true and data when status is 2xx', () => {
      const res = (service as any).formatValid({
        status: 200,
        response: { foo: 'bar' },
      });
      expect(res.valid).toBe(true);
      expect(res.data).toEqual({ foo: 'bar' });
    });

    it('should return valid false and null data when status is not 2xx', () => {
      const res = (service as any).formatValid({
        status: 400,
        response: { error: 'bad' },
      });
      expect(res.valid).toBe(false);
      expect(res.data).toBeNull();
    });
  });
});
