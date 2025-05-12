import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MisService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async getMisInfo(misId: string): Promise<any> {
    try {
      const misEndpoint = this.configService.get<string>('CLARISA_ENDPOINT');
      const url = `${misEndpoint}/mises/get/${misId}`;
      const response = await firstValueFrom(this.httpService.get(url));

      if (response.status === 200 && response.data) {
        return response.data;
      }
      throw new HttpException('MIS not found', HttpStatus.NOT_FOUND);
    } catch (error) {
      if (error.response && error.response.status === 404) {
        throw new HttpException('MIS not found', HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        'Error validating MIS ID',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
