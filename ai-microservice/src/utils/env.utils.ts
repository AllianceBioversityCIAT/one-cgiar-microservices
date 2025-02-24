import { ConfigService } from '@nestjs/config';

export class ENV {
  constructor(private readonly configService: ConfigService) {}

  get IS_PRODUCTION(): boolean {
    return this.validateEnvBoolean(
      this.configService.get<string>('IS_PRODUCTION'),
    );
  }

  get SEE_ALL_LOGS(): boolean {
    return this.validateEnvBoolean(
      this.configService.get<string>('SEE_ALL_LOGS'),
    );
  }

  private validateEnvBoolean(value: string): boolean {
    return value === 'true';
  }
}
