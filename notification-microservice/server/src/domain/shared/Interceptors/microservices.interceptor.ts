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
    const data = context.switchToRpc().getData();
    const payload: ConfigMessageSocketDto = data;
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
