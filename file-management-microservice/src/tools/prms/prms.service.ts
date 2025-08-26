import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Prms } from './prms.connection';
import { PrmsTokenValidationResponse } from './dto/prms.dto';

@Injectable()
export class PrmsService {
  private readonly connection: Prms;

  constructor(private readonly _http: HttpService) {
    this.connection = new Prms(this._http);
  }

  async validateToken(
    token: string,
    environmentUrl: string,
  ): Promise<PrmsTokenValidationResponse> {
    return await this.connection.validateToken(token, environmentUrl);
  }
}
