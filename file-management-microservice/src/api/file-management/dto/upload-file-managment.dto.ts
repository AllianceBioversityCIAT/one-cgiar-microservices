import { ApiProperty } from '@nestjs/swagger';

export class UploadFileDto {
  @ApiProperty({ description: 'Name of the file' })
  fileName: string;

  @ApiProperty({ description: 'Name of the S3 bucket' })
  bucketName: string;

  @ApiProperty({ description: 'File to upload' })
  file: any;

  @ApiProperty({ description: 'Page limit' })
  pageLimit?: number;

  @ApiProperty({ description: 'Weigth limit' })
  weightLimit?: number;
}

export class FileValidationDto {
  @ApiProperty({ description: 'Name of the S3 bucket' })
  bucketName: string;

  @ApiProperty({ description: 'Key of the file in the S3 bucket' })
  key: string;
}
