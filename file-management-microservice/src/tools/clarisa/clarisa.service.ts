import { Injectable } from '@nestjs/common';
import { Clarisa } from './clarisa.connection';
import { HttpService } from '@nestjs/axios';
import { env } from 'process';
import {
  ClarisaCreateConenctionDto,
  MisConfigDto,
  ResClarisaCreateConectioDto,
  ResClarisaValidateConectioDto,
} from './dto/clarisa-create-conection.dto';
import { ResponseClarisaDto } from '../../shared/global-dto/response-clarisa.dto';

@Injectable()
export class ClarisaService {
  private readonly connection: Clarisa;
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
