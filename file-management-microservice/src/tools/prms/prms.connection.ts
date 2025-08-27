import { HttpService } from '@nestjs/axios';
import { firstValueFrom, map } from 'rxjs';
import { BadRequestException, Logger } from '@nestjs/common';
import { PrmsTokenValidationResponse } from './dto/prms.dto';

export class Prms {
  private readonly prmsHost: string;
  private readonly http: HttpService;
  private readonly isProduction: boolean;
  private readonly logger = new Logger(Prms.name);

  constructor(http: HttpService) {
    this.http = http;
  }

  public async validateToken(
    token: string,
    environmentUrl: string,
  ): Promise<PrmsTokenValidationResponse> {
    if (!token) {
      throw new BadRequestException('Token is required');
    }
    try {
      return await firstValueFrom(
        this.http
          .post(
            environmentUrl + 'auth/user/validate-token',
            {},
            {
              headers: {
                'auth': token,
              },
            },
          )
          .pipe(
            map(({ data }) => {
              const user = data?.response;
              return {
                id: user?.id,
                email: user?.email,
                first_name: user?.first_name,
                last_name: user?.last_name,
                is_valid: user?.is_valid,
              };
            }),
          ),
      );
    } catch (err) {
      console.log("🚀 ~ Prms ~ validateToken ~ err:", err)
      this.logger.error(
        `Failed to validate PRMS token: ${err.message}`,
        err.stack,
      );
      throw new BadRequestException(
        `Failed to validate PRMS token: ${err.message}`,
      );
    }
  }
}
