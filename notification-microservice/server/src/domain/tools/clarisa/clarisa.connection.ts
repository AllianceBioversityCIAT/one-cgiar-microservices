import { HttpService } from '@nestjs/axios';
import { firstValueFrom, map } from 'rxjs';
import { env } from 'process';
import { BadRequestException } from '@nestjs/common';
import { decode } from 'jsonwebtoken';

export class Clarisa {
  private clarisaHost: string;
  private authBody: ClarisaOptions;
  private token: string;
  private http: HttpService;
  constructor(http: HttpService, config: ClarisaOptions) {
    this.clarisaHost = env.MS_CLARISA_HOST + 'api/';
    this.authBody = {
      login: config.login,
      password: config.password,
    };
    this.http = http;
  }

  private async getToken(): Promise<string> {
    if (!this.token || !this.validToken(this.token)) {
      console.log(`[Clarisa Auth] Attempting login to: ${env.MS_CLARISA_HOST}auth/login`);
      console.log(`[Clarisa Auth] Login: ${this.authBody.login}`);
      console.log(`[Clarisa Auth] Password Length: ${this.authBody.password?.length}`);
      if (this.authBody.password) {
        console.log(`[Clarisa Auth] Password starts with ": ${this.authBody.password.startsWith('"')}`);
        console.log(`[Clarisa Auth] Password ends with ": ${this.authBody.password.endsWith('"')}`);
        console.log(`[Clarisa Auth] First 2 chars: ${this.authBody.password.substring(0, 2)}`);
        console.log(`[Clarisa Auth] Last 2 chars: ${this.authBody.password.substring(this.authBody.password.length - 2)}`);
      }

      this.token = await firstValueFrom(
        this.http.post(env.MS_CLARISA_HOST + 'auth/login', this.authBody).pipe(
          map(({ data }) => {
            return data.access_token;
          }),
        ),
      );
    }
    return this.token;
  }

  private validToken(token: string): boolean {
    const decoded = decode(token) as unknown as JwtClarisa;
    const now = Math.floor(Date.now() / 1000);
    if (decoded && typeof decoded === 'object' && 'exp' in decoded) {
      if (decoded.exp > now) return true;
    }
    return false;
  }

  public async post<T, X = T>(path: string, data: T): Promise<X> {
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
    ).catch((err) => {
      throw new BadRequestException(err);
    });
  }
}

interface ClarisaOptions {
  login: string;
  password: string;
}

interface JwtClarisa {
  login: string;
  sub: number;
  permissions: string[];
  iat: number;
  exp: number;
}
