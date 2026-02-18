import { ApiProperty } from '@nestjs/swagger';

export class PdfUrlResponseDto {
  @ApiProperty({
    description: 'S3 URL to retrieve the generated PDF',
    example: 'https://my-bucket.s3.amazonaws.com/report-001.pdf',
  })
  public url: string;
}
