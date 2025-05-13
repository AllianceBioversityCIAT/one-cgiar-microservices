import { ApiProperty } from '@nestjs/swagger';

/**
 * Response model for authentication URL
 */
export class AuthUrlResponse {
  @ApiProperty({
    description: 'Authentication URL for the specified provider',
    example: 'https://ost-toc.auth.us-east-1.amazoncognito.com/oauth2/authorize?response_type=code&client_id=client-id&redirect_uri=https://example.com/callback&scope=openid+email+profile&identity_provider=CGIAR-AzureAD',
  })
  authUrl: string;
}

/**
 * Response model for token information
 */
export class TokenResponse {
  @ApiProperty({
    description: 'OAuth 2.0 access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'OAuth 2.0 ID token containing user information',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  idToken: string;

  @ApiProperty({
    description: 'OAuth 2.0 refresh token',
    example: 'refresh-token-value',
  })
  refreshToken: string;

  @ApiProperty({
    description: 'Token expiration time in seconds',
    example: 3600,
  })
  expiresIn: number;

  @ApiProperty({
    description: 'Type of token',
    example: 'Bearer',
  })
  tokenType: string;
}

/**
 * Response model for error information
 */
export class ErrorResponse {
  @ApiProperty({
    description: 'HTTP status code',
    example: 400,
  })
  statusCode: number;

  @ApiProperty({
    description: 'Error message',
    example: 'Error validating MIS ID',
  })
  message: string;

  @ApiProperty({
    description: 'Request path that generated the error',
    example: '/auth/login/provider',
  })
  path: string;

  @ApiProperty({
    description: 'Timestamp',
    example: '2025-05-13T12:34:56.789Z',
  })
  timestamp: string;
}
