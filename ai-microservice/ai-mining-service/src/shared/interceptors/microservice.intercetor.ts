import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ClarisaService } from '../../tools/clarisa/clarisa.service';
import { AuthorizationDto } from '../global-dto/auth.dto';
import { ResClarisaValidateConectioDto } from '../../tools/clarisa/dto/clarisa-create-conection.dto';
import { NotificationsService } from '../../notifications/notifications.service';

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
    const data = context.switchToRpc().getData();
    const { credentials } = data;
    const payload: AuthorizationDto = JSON.parse(credentials || '{}');
    this._logger.debug(
      `A client ${payload.username} is trying to access to the Reports Microservice`,
    );

    const authData = await this._clarisaService.authorization(
      payload?.username,
      payload?.password,
    );

    if (!authData.valid) {
      await this._notificationService.sendSlackNotification(
        ':alert:',
        'Reports Microservice',
        '#FF0000',
        'Invalid credentials',
        `User ${payload.username} tried to access the Reports Microservice with invalid credentials`,
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
      `The Client ${newData.user.sender.sender_mis.name} in the ${newData.user.sender.sender_mis.environment} environment is authorized to access the Reports Microservice`,
    );
    return next.handle().pipe(map(() => newData));
  }
}
