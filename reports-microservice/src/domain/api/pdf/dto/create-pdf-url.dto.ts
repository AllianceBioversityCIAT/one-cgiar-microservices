import { ApiProperty } from '@nestjs/swagger';

export class CreatePdfUrlDto {
  @ApiProperty({
    description: 'Key-value pairs for URL query parameters. May include optional paperWidth and paperHeight (strings, e.g. "600px", "1000px") for PDF dimensions; if omitted or empty, env GOTENBERG_PAPER_WIDTH/GOTENBERG_PAPER_HEIGHT are used.',
    example: { id: 1, test: true, paperWidth: '600px', paperHeight: '1000px' },
  })
  public data: Record<string, string | number | boolean>;

  @ApiProperty({
    description: 'Optional paper width for PDF (e.g. "600px"). Overrides env when provided. If sent here, takes precedence over data.paperWidth.',
    example: '600px',
    required: false,
  })
  public paperWidth?: string;

  @ApiProperty({
    description: 'Optional paper height for PDF (e.g. "1000px"). Overrides env when provided. If sent here, takes precedence over data.paperHeight.',
    example: '1000px',
    required: false,
  })
  public paperHeight?: string;

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
