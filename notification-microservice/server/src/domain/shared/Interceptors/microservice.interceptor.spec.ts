import { Test } from '@nestjs/testing';
import { AuthInterceptor } from './microservices.interceptor';
import {
  ClarisaService,
  ResponseValidateClarisa,
} from '../../tools/clarisa/clarisa.service';
import {
  ExecutionContext,
  CallHandler,
  UnauthorizedException,
} from '@nestjs/common';
import { of } from 'rxjs';
import { ResClarisaValidateConectioDto } from '../../tools/clarisa/dtos/clarisa-create-conection.dto';

describe('AuthInterceptor', () => {
  let interceptor: AuthInterceptor;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthInterceptor,
        {
          provide: ClarisaService,
          useValue: {
            authorization: jest.fn(),
          },
        },
      ],
    }).compile();

    interceptor = moduleRef.get<AuthInterceptor>(AuthInterceptor);
  });

  it('should allow valid credentials', async () => {
    const context: ExecutionContext = {
      switchToRpc: () => ({
        getData: () =>
          JSON.stringify({
            auth: {
              username: 'f218c4bf-c9a9-477c',
              password: '477c{85dsadf#3e2d55./120283d',
            },
          }),
      }),
    } as unknown as ExecutionContext;
    const next: CallHandler = {
      handle: () => of('next'),
    };

    const data: ResponseValidateClarisa<ResClarisaValidateConectioDto> = {
      data: {
        client_id: 'f218c4bf-c9a9-477c',
        receiver_mis: {
          acronym: 'SELFTEST',
          code: 1234,
          environment: 'TEST',
          name: 'testing',
        },
        sender_mis: {
          acronym: 'APPTEST',
          code: 5678,
          environment: 'TEST',
          name: 'testing',
        },
      },
      valid: true,
    };

    jest
      .spyOn(interceptor['clarisaService'], 'authorization')
      .mockResolvedValue(data);

    await expect(
      (await interceptor.intercept(context, next)).subscribe((res) => {
        expect(res).toEqual({
          data: { environment: 'TEST' },
          auth: {
            username: 'f218c4bf-c9a9-477c',
            password: '477c{85dsadf#3e2d55./120283d',
          },
          application: {
            client_id: 'f218c4bf-c9a9-477c',
            receiver_mis: {
              acronym: 'SELFTEST',
              code: 1234,
              environment: 'TEST',
              name: 'testing',
            },
            sender_mis: {
              acronym: 'APPTEST',
              code: 5678,
              environment: 'TEST',
              name: 'testing',
            },
          },
        });
      }),
    );
  });

  it('should throw UnauthorizedException for invalid credentials', async () => {
    const context: ExecutionContext = {
      switchToRpc: () => ({
        getData: () =>
          JSON.stringify({ auth: { username: 'user', password: 'wrong' } }),
      }),
    } as unknown as ExecutionContext;
    const next: CallHandler = {
      handle: () => of('next'),
    };

    const data: ResponseValidateClarisa<ResClarisaValidateConectioDto> = {
      data: null,
      valid: false,
    };

    jest
      .spyOn(interceptor['clarisaService'], 'authorization')
      .mockResolvedValue(data);
    expect(interceptor.intercept(context, next)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
