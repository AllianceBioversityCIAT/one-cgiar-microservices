import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { ClarisaService } from '../../tools/clarisa/clarisa.service';
import { AuthorizationDto } from '../global-dto/auth.dto';
import { ResClarisaValidateConectioDto } from '../../tools/clarisa/dto/clarisa-create-conection.dto';
import { NotificationsService } from '../../api/notifications/notifications.service';

@Injectable()
export class AuthInterceptor implements NestInterceptor {
  private readonly _logger = new Logger(AuthInterceptor.name);
  constructor(
    private readonly _clarisaService: ClarisaService,
    private readonly _notificationService: NotificationsService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const data = context.switchToRpc().getData() || {};
    const apiKey = data.apiKey || data.api_key;
    const { credentials } = data;

    if (typeof apiKey === 'string' && apiKey.trim()) {
      let pattern = '';
      const rmqCtx = context.switchToRpc().getContext();
      if (rmqCtx && typeof rmqCtx.getPattern === 'function') {
        pattern = rmqCtx.getPattern();
      }
      if (!pattern) {
        const handler = context.getHandler();
        if (handler) {
          pattern = handler.name;
        }
      }

      this._logger.debug(
        `A client is trying to access the File Management Microservice using API Key`,
      );

      const authData = await this._clarisaService.validateApiKey(
        apiKey,
        pattern,
      );

      if (!authData.valid || !authData.data) {
        const maskedKey = apiKey.substring(0, 16) + '...';
        await this._notificationService.sendSlackNotification(
          ':alert:',
          'File Management Microservice',
          '#FF0000',
          'Invalid API Key',
          `User tried to access the File Management Microservice with invalid API Key (Key: ${maskedKey})`,
          'Medium',
        );
        throw new UnauthorizedException('Invalid credentials');
      }

      const newData = {
        ...data,
        user: {
          username: apiKey.substring(0, 16) + '...',
          environment: (authData.data as ResClarisaValidateConectioDto)
            .receiver_mis.environment,
          sender: authData.data,
        },
      };

      this._logger.log(
        `The Client ${newData.user.sender.sender_mis.name} in the ${newData.user.sender.sender_mis.environment} environment is authorized to access the File Management Microservice`,
      );
      return next.handle();
    }

    const payload: AuthorizationDto = JSON.parse(credentials || '{}');
    this._logger.debug(
      `A client ${payload.username} is trying to access to the File Management Microservice`,
    );

    const authData = await this._clarisaService.authorization(
      payload?.username,
      payload?.password,
    );

    if (!authData.valid) {
      await this._notificationService.sendSlackNotification(
        ':alert:',
        'File Management Microservice',
        '#FF0000',
        'Invalid credentials',
        `User ${payload.username} tried to access the File Management Microservice with invalid credentials`,
        'Medium',
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    const newData = {
      ...data,
      user: {
        ...payload,
        environment: (authData.data as ResClarisaValidateConectioDto)
          .receiver_mis.environment,
        sender: authData.data,
      },
    };

    this._logger.log(
      `The Client ${newData.user.sender.sender_mis.name} in the ${newData.user.sender.sender_mis.environment} environment is authorized to access the File Management Microservice`,
    );
    return next.handle();
  }
}
