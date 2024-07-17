import { Injectable } from '@nestjs/common';
import { Clarisa } from './clarisa.connection';
import { HttpService } from '@nestjs/axios';
import { env } from 'process';
import { ResponseClarisaDtio } from '../../shared/global-dto/response-clarisa.dto';
import {
  ClarisaCreateConenctionDto,
  MisConfigDto,
  ResClarisaCreateConectioDto,
  ResClarisaValidateConectioDto,
} from './dtos/clarisa-create-conection.dto';

@Injectable()
export class ClarisaService {
  private connection: Clarisa;
  private readonly misSettings: MisConfigDto = {
    acronym: env.CLARISA_MIS,
    environment: env.CLARISA_MIS_ENV,
  };
  constructor(private readonly _http: HttpService) {
    this.connection = new Clarisa(this._http, {
      login: env.CLARISA_LOGIN,
      password: env.CLARISA_PASSWORD,
    });
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
      .then((res) => this.formatValid(res))
      .catch((err) => this.formatValid(err));
  }

  async createConnection(
    mis: MisConfigDto,
  ): Promise<ResClarisaCreateConectioDto> {
    return this.connection
      .post<
        ClarisaCreateConenctionDto,
        ResponseClarisaDtio<ResClarisaCreateConectioDto>
      >('app-secret/create', {
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
