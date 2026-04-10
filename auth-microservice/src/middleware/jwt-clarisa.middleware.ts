import { Request, Response, NextFunction } from 'express';
import {
  BadGatewayException,
  Injectable,
  Logger,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { ClarisaService } from '../tools/clarisa/clarisa.service';
import { ResMisConfigDto } from '../tools/clarisa/dto/clarisa-create-conection.dto';
import { AuthorizationDto } from '../shared/global-dto/auth.dto';
import { MisMetadataDto } from '../tools/clarisa/dto/mis-medatada.dto';

@Injectable()
export class JwtClarisaMiddleware implements NestMiddleware {
  private readonly logger = new Logger(JwtClarisaMiddleware.name);

  constructor(private readonly clarisaService: ClarisaService) {}

  async use(req: RequestWithCustomAttrs, _res: Response, next: NextFunction) {
    let authHeader: AuthorizationDto;

    if (typeof req.headers['auth'] === 'string') {
      try {
        authHeader = JSON.parse(req.headers['auth']);
        this.logger.debug(
          `Client ${authHeader.username} is trying to access the Auth microservice`,
        );
      } catch (error) {
        this.logger.error('Invalid auth header format', error);
        throw new UnauthorizedException('Invalid auth header format.');
      }
    } else {
      this.logger.error('Auth header is missing or not in the correct format');
      throw new BadGatewayException(
        'Auth header is missing or not in the correct format.',
      );
    }

    try {
      const authData = await this.clarisaService.authorization(
        authHeader.username,
        authHeader.password,
      );

      if (!authData.valid || !authData.data) {
        this.logger.error('Invalid credentials');
        throw new UnauthorizedException('Invalid credentials.');
      }

      const validationData = authData.data as {
        client_id: string;
        sender_mis: ResMisConfigDto;
        receiver_mis: ResMisConfigDto;
        sender_mis_metadata: MisMetadataDto;
      };

      const senderMisMetadata = validationData.sender_mis_metadata;

      if (!senderMisMetadata || !senderMisMetadata.mis_auth) {
        this.logger.error(
          `MIS ID ${validationData.sender_mis.id} does not have authentication configuration`,
        );
        throw new UnauthorizedException(
          'MIS does not have authentication configuration.',
        );
      }

      this.logger.log(
        `Client ${validationData.sender_mis.name} (ID: ${validationData.sender_mis.id}) in the ${validationData.sender_mis.environment} environment is authorized to access the Auth Microservice`,
      );

      req.application = validationData.receiver_mis;
      req.senderId = validationData.sender_mis.id;
      req.senderMisMetadata = senderMisMetadata;

      next();
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadGatewayException
      ) {
        throw error;
      }
      this.logger.error('Error validating client credentials', error);
      throw new UnauthorizedException('Error validating client credentials.');
    }
  }
}

export interface RequestWithCustomAttrs extends Request {
  [key: string]: any;
  application?: ResMisConfigDto;
  senderId?: number;
  senderMisMetadata?: MisMetadataDto;
}
