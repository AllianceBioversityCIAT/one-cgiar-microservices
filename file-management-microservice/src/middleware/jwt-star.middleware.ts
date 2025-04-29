import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { StarService } from '../tools/star/star.service';

declare global {
  namespace Express {
    interface Request {
      starUser?: any;
    }
  }
}

@Injectable()
export class JwtStarMiddleware implements NestMiddleware {
  constructor(private readonly starService: StarService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.headers['access-token'] as string;

      if (!token) {
        throw new UnauthorizedException('No access-token provided');
      }

      const validationResult = await this.starService.validateToken(token);

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
