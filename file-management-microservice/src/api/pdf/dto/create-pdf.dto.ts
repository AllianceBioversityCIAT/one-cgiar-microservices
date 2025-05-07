import { ApiProperty } from '@nestjs/swagger';

export class CreatePdfDto {
  @ApiProperty({ description: 'The data to be used in the template' })
  public data: any;

  @ApiProperty({
    description: 'The template data, with handlebars syntax',
  })
  public templateData: string;

  @ApiProperty({ description: 'The options to be used in the pdf generation' })
  public options: any;

  @ApiProperty({ description: 'The bucket name to store the file' })
  public bucketName: string;

  @ApiProperty({ description: 'The file name to store the file' })
  public fileName: string;
}
