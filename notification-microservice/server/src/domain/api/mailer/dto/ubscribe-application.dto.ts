import { ApiProperty } from '@nestjs/swagger';

export class SubscribeApplicationDto {
  @ApiProperty({
    required: true,
    description: 'Acronym of the application',
    example: 'APP',
    name: 'acronym',
    type: String,
  })
  public acronym: string;
  @ApiProperty({
    required: true,
    description: 'Name of the application',
    example: 'Application',
    name: 'environment',
    type: String,
  })
  public environment: string;
}
