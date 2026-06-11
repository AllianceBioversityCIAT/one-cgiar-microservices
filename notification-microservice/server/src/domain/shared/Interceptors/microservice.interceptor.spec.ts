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
import { of, firstValueFrom } from 'rxjs';
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
            validateApiKey: jest.fn(),
          },
        },
      ],
    }).compile();

    interceptor = moduleRef.get<AuthInterceptor>(AuthInterceptor);
  });

  it('should allow valid credentials', async () => {
    const testData = {
      auth: {
        username: 'f218c4bf-c9a9-477c',
        password: '477c{85dsadf#3e2d55./120283d',
      },
    };
    const context: ExecutionContext = {
      switchToRpc: () => ({
        getData: () => testData,
        getContext: () => ({}),
      }),
    } as unknown as ExecutionContext;
    const next: CallHandler = {
      handle: () => of('next'),
    };

    const authData: ResponseValidateClarisa<ResClarisaValidateConectioDto> = {
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
      .mockResolvedValue(authData);

    const obs = await interceptor.intercept(context, next);
    const result = await firstValueFrom(obs);

    expect(result).toEqual('next');
    expect(testData).toEqual({
      auth: {
        username: 'f218c4bf-c9a9-477c',
        password: '477c{85dsadf#3e2d55./120283d',
      },
      data: {
        environment: 'TEST',
        sender: authData.data,
      },
    });
  });

  it('should throw UnauthorizedException for invalid credentials', async () => {
    const testData = {
      auth: { username: 'user', password: 'wrong' },
    };
    const context: ExecutionContext = {
      switchToRpc: () => ({
        getData: () => testData,
        getContext: () => ({}),
      }),
    } as unknown as ExecutionContext;
    const next: CallHandler = {
      handle: () => of('next'),
    };

    const authData: ResponseValidateClarisa<ResClarisaValidateConectioDto> = {
      data: null,
      valid: false,
    };

    jest
      .spyOn(interceptor['clarisaService'], 'authorization')
      .mockResolvedValue(authData);

    await expect(interceptor.intercept(context, next)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should allow valid API Key', async () => {
    const testData = {
      apiKey: 'valid-api-key',
      auth: {},
    };
    const getPattern = jest.fn().mockReturnValue('test.pattern');
    const context: ExecutionContext = {
      switchToRpc: () => ({
        getData: () => testData,
        getContext: () => ({ getPattern }),
      }),
    } as unknown as ExecutionContext;
    const next: CallHandler = {
      handle: () => of('next'),
    };

    const authData: ResponseValidateClarisa<ResClarisaValidateConectioDto> = {
      data: {
        client_id: 'valid-api-key-masked',
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
      .spyOn(interceptor['clarisaService'], 'validateApiKey')
      .mockResolvedValue(authData);

    const obs = await interceptor.intercept(context, next);
    const result = await firstValueFrom(obs);

    expect(result).toEqual('next');
    expect(interceptor['clarisaService'].validateApiKey).toHaveBeenCalledWith(
      'valid-api-key',
      'test.pattern',
    );
    expect(testData).toEqual({
      apiKey: 'valid-api-key',
      auth: {
        username: 'valid-api-key...',
      },
      data: {
        environment: 'TEST',
        sender: authData.data,
      },
    });
  });

  it('should throw UnauthorizedException for invalid API Key', async () => {
    const testData = {
      api_key: 'invalid-api-key',
      auth: {},
    };
    const context: ExecutionContext = {
      switchToRpc: () => ({
        getData: () => testData,
        getContext: () => ({}),
      }),
      getHandler: () => ({ name: 'testHandler' }),
    } as unknown as ExecutionContext;
    const next: CallHandler = {
      handle: () => of('next'),
    };

    const authData: ResponseValidateClarisa<ResClarisaValidateConectioDto> = {
      data: null,
      valid: false,
    };

    jest
      .spyOn(interceptor['clarisaService'], 'validateApiKey')
      .mockResolvedValue(authData);

    await expect(interceptor.intercept(context, next)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(interceptor['clarisaService'].validateApiKey).toHaveBeenCalledWith(
      'invalid-api-key',
      'testHandler',
    );
  });
});
