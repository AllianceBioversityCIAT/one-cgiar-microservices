import { env } from 'process';

export class ENV {
  static get IS_PRODUCTION(): boolean {
    return env.MS_ENVIRONMENT == 'production';
  }
  static get SEE_ALL_LOGS(): boolean {
    return ENV.validateEnvBoolean(env.MS_SEE_ALL_LOGS);
  }

  private static validateEnvBoolean(pv: string): boolean {
    return pv == 'true';
  }
}
