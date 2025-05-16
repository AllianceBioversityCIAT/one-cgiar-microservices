import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Star } from './star.connection';
import { StarTokenValidationResponse } from './dto/star.dto';

@Injectable()
export class StarService {
  private readonly connection: Star;

  constructor(private readonly _http: HttpService) {
    this.connection = new Star(this._http);
  }

  async validateToken(
    token: string,
    environmentUrl: string,
  ): Promise<StarTokenValidationResponse> {
    return await this.connection.validateToken(token, environmentUrl);
  }
}
