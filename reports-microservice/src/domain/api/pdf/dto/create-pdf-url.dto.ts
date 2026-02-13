import { ApiProperty } from '@nestjs/swagger';

export class CreatePdfUrlDto {
  @ApiProperty({
    description: 'Key-value pairs for URL query parameters',
    example: { id: 1, test: true },
  })
  public data: Record<string, string | number | boolean>;

  @ApiProperty({
    description: 'Template identifier (e.g., "001" maps to /001)',
    example: '001',
  })
  public templateName: string;

  @ApiProperty({
    description: 'S3 bucket name',
    example: 'my-reports-bucket',
  })
  public bucketName: string;

  @ApiProperty({
    description: 'S3 object key (file name)',
    example: 'report-001.pdf',
  })
  public fileName: string;
}
