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
import { AuthorizationDto } from '../shared/global-dto/auth.dto';
import { ClarisaService } from '../tools/clarisa/clarisa.service';
import { ResClarisaValidateConectioDto } from '../tools/clarisa/dto/clarisa-create-conection.dto';
import { NotificationsService } from '../api/notifications/notifications.service';

@Injectable()
export class JwtClarisaMiddleware implements NestMiddleware {
  private readonly _logger = new Logger(JwtClarisaMiddleware.name);
  constructor(
    private readonly clarisaService: ClarisaService,
    private readonly _notificationService: NotificationsService,
  ) {}

  async use(
    @Req() req: RequestWithCustomAttrs,
    @Res() _res: Response,
    @Next() next: NextFunction,
  ) {
    let authHeader: AuthorizationDto;
    console.log("🚀 ~ JwtClarisaMiddleware ~ authHeader:", authHeader)
    if (typeof req.headers['acess-token'] === 'string') {
      try {
        authHeader = JSON.parse(req.headers['acess-token']);
        this._logger.debug(
          `A client ${authHeader.username} is trying to access to the File Management microservice`,
        );
      } catch (error) {
        await this._notificationService.sendSlackNotification(
          ':alert:',
          'File Management Microservice',
          '#FF0000',
          'Invalid credentials',
          `Auth header is missing or not in the correct format. ${error}`,
          'Medium',
        );
        throw new UnauthorizedException('Invalid auth header format.');
      }
    } else {
      await this._notificationService.sendSlackNotification(
        ':alert:',
        'File Management Microservice',
        '#FF0000',
        'Invalid credentials',
        'Auth header is missing or not in the correct format.',
        'Medium',
      );
      throw new BadGatewayException(
        'Auth header is missing or not in the correct format.',
      );
    }

    const authData = await this.clarisaService.authorization(
      authHeader.username,
      authHeader.password,
    );

    if (!authData.data) {
      await this._notificationService.sendSlackNotification(
        ':alert:',
        'File Management Microservice',
        '#FF0000',
        'Invalid credentials',
        'The user is not authorized to access this microservice.',
        'Medium',
      );
      throw new UnauthorizedException('Invalid credentials.');
    }

    this._logger.log(
      `The Client ${(authData.data as ResClarisaValidateConectioDto).sender_mis.name} in the ${(authData.data as ResClarisaValidateConectioDto).sender_mis.environment} environment is authorized to access the File Management Microservice`,
    );
    req.application = (
      authData.data as ResClarisaValidateConectioDto
    ).receiver_mis;
    next();
  }
}

interface RequestWithCustomAttrs extends Request {
  [key: string]: any;
}
