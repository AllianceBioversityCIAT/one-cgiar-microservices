import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Clarisa } from './clarisa.connection';
import { HttpService } from '@nestjs/axios';
import {
  ClarisaCreateConenctionDto,
  MisConfigDto,
  ResClarisaCreateConectioDto,
  ResClarisaValidateConectioDto,
} from './dto/clarisa-create-conection.dto';
import { ResponseClarisaDto } from '../../shared/global-dto/response-clarisa.dto';

@Injectable()
export class ClarisaService {
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
