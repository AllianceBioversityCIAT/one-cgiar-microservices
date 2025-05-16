import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { StarService } from '../tools/star/star.service';

interface StarAuthenticatedRequest extends Request {
  starUser?: any;
}

@Injectable()
export class JwtStarMiddleware implements NestMiddleware {
  constructor(private readonly starService: StarService) {}

  async use(req: StarAuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const token = req.headers['access-token'] as string;
      const environmentUrl = req.headers['environment-url'] as string;

      if (!token) {
        throw new UnauthorizedException('No access-token provided');
      }
      if (!environmentUrl) {
        throw new UnauthorizedException('No environmentUrl provided');
      }

      const validationResult = await this.starService.validateToken(
        token,
        environmentUrl,
      );

      if (!validationResult.isValid) {
        throw new UnauthorizedException('Invalid or expired token');
      }

      req.starUser = validationResult.user;

      next();
    } catch (error) {
      throw new UnauthorizedException(
        'Authentication failed: ' + error.message,
      );
    }
  }
}
