import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiSecurity,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponse } from '../swagger/responses-swagger';

/**
 * Decorator to apply CLARISA authentication documentation to endpoints
 * @param summary Summary of the endpoint
 * @returns Decorators for CLARISA secured endpoints
 */
export function ApiClarisaAuth(summary: string) {
  return applyDecorators(
    ApiOperation({ summary }),
    ApiSecurity('clarisa-auth'),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - Invalid CLARISA credentials',
      type: ErrorResponse,
    }),
  );
}
