import { HttpService } from '@nestjs/axios';
import { firstValueFrom, map } from 'rxjs';
import { BadRequestException, Logger } from '@nestjs/common';
import { decode } from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';

export class Clarisa {
  private readonly clarisaHost: string;
  private readonly authBody: ClarisaOptions;
  private token: string;
  private readonly http: HttpService;
  private readonly logger = new Logger(Clarisa.name);

  constructor(
    http: HttpService,
    config: ClarisaOptions,
    private readonly configService: ConfigService,
  ) {
    const clarisaUrl = this.configService.get('CLARISA_HOST');
    this.clarisaHost = clarisaUrl + 'api/';
    this.authBody = {
      login: config.login,
      password: config.password,
    };
    this.http = http;
  }

  private async getToken(): Promise<string> {
    if (!this.token || !this.validToken(this.token)) {
      try {
        this.logger.log('Getting new CLARISA token');
        this.token = await firstValueFrom(
          this.http.post(this.configService.get('CLARISA_HOST') + 'auth/login', this.authBody).pipe(
            map(({ data }) => {
              return data.access_token;
            }),
          ),
        );
        this.logger.log('CLARISA token obtained successfully');
      } catch (error) {
        this.logger.error('Error getting CLARISA token', error);
        throw new BadRequestException(
          'Error authenticating with CLARISA: ' + error.message,
        );
      }
    }
    return this.token;
  }

  private validToken(token: string): boolean {
    try {
      const decoded = decode(token) as unknown as JwtClarisa;
      const now = Math.floor(Date.now() / 1000);
      if (decoded && typeof decoded === 'object' && 'exp' in decoded) {
        if (decoded.exp > now) return true;
      }
      return false;
    } catch (error) {
      this.logger.error('Error validating CLARISA token', error);
      return false;
    }
  }

  public async post<T, X = T>(path: string, data: T): Promise<X> {
    try {
      const token = await this.getToken();
      return firstValueFrom(
        this.http
          .post<X>(this.clarisaHost + path, data, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })
          .pipe(
            map(({ data }) => {
              return data;
            }),
          ),
      );
    } catch (error) {
      this.logger.error(`Error in CLARISA API call to ${path}`, error);
      throw new BadRequestException(
        `Error in CLARISA API call: ${error.message}`,
      );
    }
  }

  public async get<X>(path: string): Promise<X> {
    try {
      const token = await this.getToken();
      return firstValueFrom(
        this.http
          .get<X>(this.clarisaHost + path, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })
          .pipe(
            map(({ data }) => {
              return data;
            }),
          ),
      );
    } catch (error) {
      this.logger.error(`Error in CLARISA API call to ${path}`, error);
      throw new BadRequestException(
        `Error in CLARISA API call: ${error.message}`,
      );
    }
  }
}

export interface ClarisaOptions {
  login: string;
  password: string;
}

export interface JwtClarisa {
  login: string;
  sub: number;
  permissions: string[];
  iat: number;
  exp: number;
}
