import { HttpStatus } from '@nestjs/common';
import { ResponseUtils } from './response.utils';

describe('ResponseUtils', () => {
  describe('format', () => {
    it('should return object with description, status, data, errors', () => {
      const input = {
        description: 'Ok',
        status: HttpStatus.OK,
        data: { id: 1 },
        errors: null,
      };

      const result = ResponseUtils.format(input);

      expect(result).toEqual({
        description: 'Ok',
        status: HttpStatus.OK,
        data: { id: 1 },
        errors: null,
      });
    });

    it('should handle missing optional fields', () => {
      const input = {
        description: 'Created',
        status: HttpStatus.CREATED,
      };

      const result = ResponseUtils.format(input);

      expect(result.description).toBe('Created');
      expect(result.status).toBe(HttpStatus.CREATED);
      expect(result.data).toBeUndefined();
      expect(result.errors).toBeUndefined();
    });
  });
});
