import { Request, Response, NextFunction } from 'express';
import {
  BadGatewayException,
  Injectable,
  NestMiddleware,
  Next,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthorizationDto } from '../global-dto/auth.dto';
import { ClarisaService } from '../../tools/clarisa/clarisa.service';
import { ResClarisaValidateConectioDto } from '../../tools/clarisa/dto/clarisa-create-conection.dto';

@Injectable()
export class JwtMiddleware implements NestMiddleware {
  private readonly ownerUser: string;

  constructor(
    private readonly clarisaService: ClarisaService,
    private readonly configService: ConfigService,
  ) {
    this.ownerUser = this.configService.get<string>('CLARISA_MIS');
  }

  async use(
    @Req() req: RequestWithCustomAttrs,
    @Res() _res: Response,
    @Next() next: NextFunction,
  ) {
    const apiKey = req.headers['x-api-key'] || req.headers['X-API-Key'];

    if (typeof apiKey === 'string' && apiKey.trim()) {
      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
        req.ip;

      const authData = await this.clarisaService.validateApiKey(
        apiKey,
        req.path,
        clientIp,
      );

      if (!authData.valid || !authData.data) {
        throw new UnauthorizedException('Invalid API key.');
      }

      req.application = authData.data.receiver_mis;
      return next();
    }

    let authHeader: AuthorizationDto;
    if (typeof req.headers['auth'] === 'string') {
      authHeader = parseAuthHeader(req.headers['auth']);
      if (!authHeader) {
        throw new UnauthorizedException('Invalid auth header format.');
      }
    } else {
      throw new BadGatewayException(
        'Auth header or X-API-Key is missing or not in the correct format.',
      );
    }

    const authData = await this.clarisaService.authorization(
      authHeader.username,
      authHeader.password,
    );

    if (!authData.data) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    if (
      (authData.data as ResClarisaValidateConectioDto).receiver_mis.acronym !==
      this.ownerUser
    ) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    req.application = (
      authData.data as ResClarisaValidateConectioDto
    ).receiver_mis;
    next();
  }
}

interface RequestWithCustomAttrs extends Request {
  [key: string]: any;
}

function parseAuthHeader(value: string): AuthorizationDto | null {
  try {
    return JSON.parse(value) as AuthorizationDto;
  } catch {
    return null;
  }
}
