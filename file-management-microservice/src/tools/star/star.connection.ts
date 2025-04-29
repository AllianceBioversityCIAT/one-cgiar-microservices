import { HttpService } from '@nestjs/axios';
import { firstValueFrom, map } from 'rxjs';
import { env } from 'process';
import { BadRequestException } from '@nestjs/common';
import { StarTokenValidationResponse } from './dto/star.dto';

export class Star {
  private readonly starHost: string;
  private readonly http: HttpService;

  constructor(http: HttpService) {
    this.starHost =
      env.STAR_HOST ||
      'https://management-allianceindicatorstest.ciat.cgiar.org/api/';
    this.http = http;
  }

  public async validateToken(
    token: string,
  ): Promise<StarTokenValidationResponse> {
    try {
      return await firstValueFrom(
        this.http
          .patch(
            this.starHost + 'authorization/validate-token',
            {},
            {
              headers: {
                'access-token': `${token}`,
              },
            },
          )
          .pipe(
            map(({ data }) => {
              return {
                isValid: data.data.isValid ?? false,
                user: data.data.user,
              };
            }),
          ),
      );
    } catch (err) {
      throw new BadRequestException(
        `Failed to validate STAR token: ${err.message}`,
      );
    }
  }
}
