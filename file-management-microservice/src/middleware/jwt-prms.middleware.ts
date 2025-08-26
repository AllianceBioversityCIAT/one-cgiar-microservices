import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrmsService } from '../tools/prms/prms.service';

interface PrmsAuthenticatedRequest extends Request {
  prmsUser?: any;
}

@Injectable()
export class JwtPrmsMiddleware implements NestMiddleware {
  constructor(private readonly prmsService: PrmsService) {}

  async use(req: PrmsAuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const token = req.headers['access-token'] as string;
      console.log("🚀 ~ JwtPrmsMiddleware ~ use ~ token:", token)
      const environmentUrl = req.headers['environment-url'] as string;

      if (!token) {
        throw new UnauthorizedException('No access-token provided');
      }
      if (!environmentUrl) {
        throw new UnauthorizedException('No environmentUrl provided');
      }

      const validationResult = await this.prmsService.validateToken(
        token,
        environmentUrl,
      );

      if (!validationResult.is_valid) {
        throw new UnauthorizedException('Invalid or expired token');
      }

      req.prmsUser = validationResult;

      next();
    } catch (error) {
      throw new UnauthorizedException(
        'Authentication failed: ' + error.message,
      );
    }
  }
}
