import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { ClarisaService } from '../../tools/clarisa/clarisa.service';
import { ConfigMessageSocketDto } from '../global-dto/mailer.dto';
import { ResClarisaValidateConectioDto } from '../../tools/clarisa/dtos/clarisa-create-conection.dto';

@Injectable()
export class AuthInterceptor implements NestInterceptor {
  constructor(private readonly clarisaService: ClarisaService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const data = context.switchToRpc().getData() || {};
    const payload: ConfigMessageSocketDto = data;
    const payloadAny = payload as any;

    const apiKey =
      data.apiKey ||
      data.api_key ||
      payloadAny?.apiKey ||
      payloadAny?.api_key ||
      payloadAny?.auth?.apiKey ||
      payloadAny?.auth?.api_key;

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

      const authData = await this.clarisaService.validateApiKey(
        apiKey,
        pattern,
      );

      if (!authData.valid || !authData.data) {
        throw new UnauthorizedException('Invalid API Key');
      }

      const newData = {
        data: {
          ...payload.data,
          environment: (authData.data as ResClarisaValidateConectioDto)
            .receiver_mis.environment,
          sender: authData.data,
        },
        auth: {
          ...payload.auth,
          username: apiKey.substring(0, 16) + '...',
        },
      };

      Object.assign(data, newData);
      return next.handle();
    }

    const authData = await this.clarisaService.authorization(
      payload?.auth?.username,
      payload?.auth?.password,
    );
    if (!authData.valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const newData = {
      data: {
        ...payload.data,
        environment: (authData.data as ResClarisaValidateConectioDto)
          .receiver_mis.environment,
        sender: authData.data,
      },
      auth: payload.auth,
    };

    Object.assign(data, newData);

    return next.handle();
  }
}
