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
    this.isProduction =
      this.validateEnvironmentVariable('IS_PRODUCTION') === 'true';

    const starHostKey = this.isProduction ? 'STAR_HOST_PROD' : 'STAR_HOST_TEST';
    this.starHost = this.validateEnvironmentVariable(starHostKey);

    if (!this.starHost.endsWith('/')) {
      this.starHost += '/';
    }

    this.http = http;
    this.logger.log(
      `Initialized Star connection with ${this.isProduction ? 'PRODUCTION' : 'TEST'} environment`,
    );
  }

  /**
   * Valida una variable de entorno y retorna su valor o lanza una excepción si no está definida
   * @param variableName Nombre de la variable de entorno
   * @param defaultValue Valor predeterminado opcional si la variable no está definida
   * @returns El valor de la variable de entorno
   */
  private validateEnvironmentVariable(
    variableName: string,
    defaultValue?: string,
  ): string {
    const value = env[variableName];

    if (value === undefined) {
      if (defaultValue !== undefined) {
        this.logger.warn(
          `Environment variable ${variableName} not defined, using default value`,
        );
        return defaultValue;
      }
      throw new Error(
        `Required environment variable ${variableName} is not defined`,
      );
    }

    return value;
  }

  public async validateToken(
    token: string,
  ): Promise<StarTokenValidationResponse> {
    if (!token) {
      throw new BadRequestException('Token is required');
    }

    try {
      return await firstValueFrom(
        this.http
          .patch(
            this.starHost + 'authorization/validate-token',
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
