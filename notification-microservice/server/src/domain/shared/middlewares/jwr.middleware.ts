import { Request, Response, NextFunction } from 'express';
import {
  BadGatewayException,
  Injectable,
  Logger,
  NestMiddleware,
  Next,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthorizationDto } from '../global-dto/auth.dto';
import { ClarisaService } from '../../tools/clarisa/clarisa.service';
import { ResClarisaValidateConectioDto } from '../../tools/clarisa/dtos/clarisa-create-conection.dto';

@Injectable()
export class JwtMiddleware implements NestMiddleware {
  private readonly _logger = new Logger(JwtMiddleware.name);
  constructor(private readonly clarisaService: ClarisaService) {}

  async use(
    @Req() req: RequestWithCustomAttrs,
    @Res() _res: Response,
    @Next() next: NextFunction,
  ) {
    let authHeader: AuthorizationDto;
    if (typeof req.headers['auth'] === 'string') {
      try {
        authHeader = JSON.parse(req.headers['auth']);
      } catch (error) {
        this._logger.error(error);
        throw new UnauthorizedException('Invalid auth header format.');
      }
    } else {
      throw new BadGatewayException(
        'Auth header is missing or not in the correct format.',
      );
    }

    const authData = await this.clarisaService.authorization(
      authHeader.username,
      authHeader.password,
    );
    if (!authData.valid) {
      throw new UnauthorizedException('Invalid credentials.');
    }
    req.application = <ResClarisaValidateConectioDto>authData.data;
    next();
  }
}

interface RequestWithCustomAttrs extends Request {
  [key: string]: any;
}
