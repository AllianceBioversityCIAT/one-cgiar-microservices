import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Clarisa } from './clarisa.connection';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  ClarisaCreateConenctionDto,
  MisConfigDto,
  ResClarisaCreateConectioDto,
  ResClarisaValidateConectioDto,
} from './dto/clarisa-create-conection.dto';
import { ResponseClarisaDto } from '../../shared/global-dto/response-clarisa.dto';

@Injectable()
export class ClarisaService {
  private readonly _logger = new Logger(ClarisaService.name);
  private connection: Clarisa;
  private readonly misSettings: MisConfigDto;

  constructor(
    private readonly _http: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.misSettings = {
      acronym: this.configService.get<string>('CLARISA_MIS'),
      environment: this.configService.get<string>('CLARISA_MIS_ENV'),
    };

    this.connection = new Clarisa(
      this._http,
      {
        login: this.configService.get<string>('CLARISA_LOGIN'),
        password: this.configService.get<string>('CLARISA_PASSWORD'),
      },
      this.configService,
    );
  }

  async authorization(clientId: string, clientSecret: string) {
    return this.connection
      .post<ClarisaSecret, ResponseClarisaDto<ResClarisaValidateConectioDto>>(
        'app-secrets/validate',
        {
          client_id: clientId,
          secret: clientSecret,
        },
      )
      .then((res) => this.formatValid(res))
      .catch((err) => this.formatValid(err));
  }

  async validateApiKey(
    apiKey: string,
    endpointAccessed: string,
    ipAddress?: string,
  ): Promise<ResponseValidateClarisa<ResClarisaValidateConectioDto>> {
    const baseUrl = this.configService.get<string>('CLARISA_HOST');

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
      microservice_name: 'Reports Ms2',
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
      if (data && data.valid) {
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
    } catch (error) {
      this._logger.error(
        'Error validating API Key in ClarisaService:',
        error.message || error,
      );
      if (error.response) {
        this._logger.error(
          'CLARISA Response error data:',
          JSON.stringify(error.response.data),
        );
        this._logger.error('CLARISA Response status:', error.response.status);
      }
      return {
        valid: false,
        data: null,
      };
    }
  }

  async createConnection(
    mis: MisConfigDto,
  ): Promise<ResClarisaCreateConectioDto> {
    const claConn = await this.connection.post<
      ClarisaCreateConenctionDto,
      ResponseClarisaDto<ResClarisaCreateConectioDto>
    >('app-secrets/create', {
      receiver_mis: this.misSettings,
      sender_mis: mis,
    });
    return this.formatValid(claConn).data;
  }

  formatValid<T>(data: ResponseClarisaDto<T>): ResponseValidateClarisa<T> {
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

class ResponseValidateClarisa<T> {
  data: T;
  valid: boolean;
}
