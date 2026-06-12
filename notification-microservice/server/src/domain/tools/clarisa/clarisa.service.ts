import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { Clarisa } from './clarisa.connection';
import { HttpService } from '@nestjs/axios';
import { env } from 'node:process';
import { ResponseClarisaDtio } from '../../shared/global-dto/response-clarisa.dto';
import {
  ClarisaCreateConenctionDto,
  MisConfigDto,
  ResClarisaCreateConectioDto,
  ResClarisaValidateConectioDto,
} from './dtos/clarisa-create-conection.dto';

@Injectable()
export class ClarisaService {
  private readonly _logger = new Logger(ClarisaService.name);
  private readonly connection: Clarisa;
  private readonly misSettings: MisConfigDto = {
    acronym: env.MS_CLARISA_MIS,
    environment: env.MS_CLARISA_MIS_ENV,
  };
  constructor(private readonly _http: HttpService) {
    this.connection = new Clarisa(this._http, {
      login: env.MS_CLARISA_LOGIN,
      password: env.MS_CLARISA_PASSWORD,
    });
  }

  async validateApiKey(
    apiKey: string,
    endpointAccessed: string,
    ipAddress?: string,
  ): Promise<ResponseValidateClarisa<ResClarisaValidateConectioDto>> {
    const baseUrl = env.MS_CLARISA_HOST;

    let normalizedUrl = baseUrl ? baseUrl.trim() : '';
    if (normalizedUrl.endsWith('/')) {
      normalizedUrl = normalizedUrl.slice(0, -1);
    }
    if (normalizedUrl.endsWith('/api')) {
      normalizedUrl = normalizedUrl.slice(0, -4);
    }

    const url = `${normalizedUrl}/api/auth/validate-api-key`;
    const body = {
      api_key: apiKey.trim(),
      microservice_name: 'Notification Ms1',
      endpoint_accessed: endpointAccessed,
      ip_address: ipAddress,
    };

    try {
      const response = await firstValueFrom(
        this._http.post(url, body, {
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      );

      const data = response.data;
      if (data?.valid) {
        const mappedData: ResClarisaValidateConectioDto = {
          client_id: apiKey.substring(0, 16),
          sender_mis: {
            code: data.mis?.id || null,
            name: data.mis?.name || '',
            acronym: data.mis?.acronym || '',
            environment: data.environment || '',
          },
          receiver_mis: {
            code: data.mis?.id || null,
            name: data.mis?.name || '',
            acronym: data.mis?.acronym || '',
            environment: data.environment || '',
          },
        };

        return {
          valid: true,
          data: mappedData,
        };
      }
      return {
        valid: false,
        data: null,
      };
    } catch (error: any) {
      this._logger.error(
        'Error validating API Key in ClarisaService:',
        error.message || error,
      );
      if (error.response) {
        this._logger.error(
          'CLARISA Response error data:',
          JSON.stringify(error.response.data),
        );
      }
      return {
        valid: false,
        data: null,
      };
    }
  }

  async authorization(clientId: string, clientSecret: string) {
    return this.connection
      .post<ClarisaSecret, ResponseClarisaDtio<ResClarisaValidateConectioDto>>(
        'app-secrets/validate',
        {
          client_id: clientId,
          secret: clientSecret,
        },
      )
      .then((res) => {
        const response = this.formatValid<ResClarisaValidateConectioDto>(res);
        if (
          response.data.receiver_mis.acronym !== env.MS_CLARISA_MIS ||
          response.data.receiver_mis.environment !== env.MS_CLARISA_MIS_ENV
        ) {
          throw new BadRequestException('Invalid credentials.');
        }
        return response;
      })
      .catch((err) => this.formatValid(err));
  }

  async createConnection(
    mis: MisConfigDto,
  ): Promise<ResClarisaCreateConectioDto> {
    return this.connection
      .post<
        ClarisaCreateConenctionDto,
        ResponseClarisaDtio<ResClarisaCreateConectioDto>
      >('app-secrets/create', {
        receiver_mis: this.misSettings,
        sender_mis: mis,
      })
      .then((res) => res.response);
  }

  formatValid<T>(data: ResponseClarisaDtio<T>): ResponseValidateClarisa<T> {
    if (data.status >= 200 && data.status < 300) {
      return {
        data: data.response,
        valid: true,
      };
    }
    return {
      data: null,
      valid: false,
    };
  }
}

class ClarisaSecret {
  client_id: string;
  secret: string;
}

export class ResponseValidateClarisa<T> {
  data: T;
  valid: boolean;
}
