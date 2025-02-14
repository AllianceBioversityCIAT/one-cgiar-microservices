import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ClarisaService } from '../../tools/clarisa/clarisa.service';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly _logger = new Logger(AuthGuard.name);
  constructor(private readonly _clarisaService: ClarisaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const data = context.switchToRpc().getData();

    if (data.credentials) {
      try {
        const credentials = JSON.parse(data.credentials);
        const { username, password } = credentials;

        const auth = await this._clarisaService.authorization(
          username,
          password,
        );

        if (!auth.valid) {
          this._logger.error('Invalid credentials');
        }

        this._logger.debug('Credentials parsed successfully');
        return auth.valid;
      } catch (error) {
        this._logger.error('Error parsing credentials', error);
        return false;
      }
    }

    this._logger.error('Credentials not found');
    return false;
  }
}
