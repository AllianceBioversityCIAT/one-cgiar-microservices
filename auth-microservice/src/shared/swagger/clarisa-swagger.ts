import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO model for CLARISA authentication header
 */
export class ClarisaAuthHeader {
  @ApiProperty({
    description: 'Client ID provided by CLARISA',
    example: 'client_12345',
  })
  username: string;

  @ApiProperty({
    description: 'Client secret provided by CLARISA',
    example: 'secret_abcdefg123456',
  })
  password: string;
}

/**
 * Response model for CLARISA MIS information
 */
export class ClarisaMisResponse {
  @ApiProperty({
    description: 'MIS unique numeric identifier',
    example: 1,
  })
  code: number;

  @ApiProperty({
    description: 'MIS acronym',
    example: 'AUTH',
  })
  acronym: string;

  @ApiProperty({
    description: 'MIS environment',
    example: 'Production',
    enum: ['Production', 'Development', 'Testing'],
  })
  environment: string;

  @ApiProperty({
    description: 'MIS full name',
    example: 'Authentication Microservice',
  })
  name: string;
}

/**
 * Response model for CLARISA connection validation
 */
export class ClarisaValidationResponse {
  @ApiProperty({
    description: 'Client ID used for validation',
    example: 'client_12345',
  })
  client_id: string;

  @ApiProperty({
    description: 'Information about the sender MIS',
    type: ClarisaMisResponse,
  })
  sender_mis: ClarisaMisResponse;

  @ApiProperty({
    description: 'Information about the receiver MIS',
    type: ClarisaMisResponse,
  })
  receiver_mis: ClarisaMisResponse;
}

/**
 * Response model for CLARISA connection creation
 */
export class ClarisaConnectionResponse extends ClarisaValidationResponse {
  @ApiProperty({
    description: 'Secret key generated for this connection',
    example: 'secret_abcdefg123456',
  })
  secret: string;
}
