import { HttpService } from '@nestjs/axios';
import { firstValueFrom, map } from 'rxjs';
import { env } from 'process';
import { BadRequestException, Logger } from '@nestjs/common';
import { StarTokenValidationResponse } from './dto/star.dto';

export class Star {
  private readonly starHost: string;
  private readonly http: HttpService;
  private readonly isProduction: boolean;
  private readonly logger = new Logger(Star.name);

  constructor(http: HttpService) {
    this.http = http;
  }

  public async validateToken(
    token: string,
    environmentUrl: string,
  ): Promise<StarTokenValidationResponse> {
    if (!token) {
      throw new BadRequestException('Token is required');
    }
    try {
      return await firstValueFrom(
        this.http
          .patch(
            environmentUrl + 'authorization/validate-token',
            {},
            {
              headers: {
                'access-token': token,
              },
            },
          )
          .pipe(
            map(({ data }) => {
              return {
                isValid: data?.data?.isValid ?? false,
                user: data?.data?.user,
              };
            }),
          ),
      );
    } catch (err) {
      this.logger.error(
        `Failed to validate STAR token: ${err.message}`,
        err.stack,
      );
      throw new BadRequestException(
        `Failed to validate STAR token: ${err.message}`,
      );
    }
  }
}
