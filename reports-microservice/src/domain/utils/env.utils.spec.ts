import { ConfigService } from '@nestjs/config';
import { ENV } from './env.utils';

describe('ENV', () => {
  let configService: jest.Mocked<ConfigService>;
  let env: ENV;

  beforeEach(() => {
    configService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;
    env = new ENV(configService);
  });

  describe('IS_PRODUCTION', () => {
    it('should return true when config returns "true"', () => {
      (configService.get as jest.Mock).mockReturnValue('true');
      expect(env.IS_PRODUCTION).toBe(true);
    });

    it('should return false when config returns "false"', () => {
      (configService.get as jest.Mock).mockReturnValue('false');
      expect(env.IS_PRODUCTION).toBe(false);
    });

    it('should return false when config returns undefined or other', () => {
      (configService.get as jest.Mock).mockReturnValue(undefined);
      expect(env.IS_PRODUCTION).toBe(false);
      (configService.get as jest.Mock).mockReturnValue('yes');
      expect(env.IS_PRODUCTION).toBe(false);
    });
  });

  describe('SEE_ALL_LOGS', () => {
    it('should return true when config returns "true"', () => {
      (configService.get as jest.Mock).mockReturnValue('true');
      expect(env.SEE_ALL_LOGS).toBe(true);
    });

    it('should return false when config returns non-"true"', () => {
      (configService.get as jest.Mock).mockReturnValue('false');
      expect(env.SEE_ALL_LOGS).toBe(false);
    });
  });
});
