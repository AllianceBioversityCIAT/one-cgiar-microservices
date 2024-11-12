import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { S3Service } from './s3.service';
import { UpdateS3Dto } from './dto/update-s3.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiTags,
} from '@nestjs/swagger';

@Controller('s3')
export class S3Controller {
  constructor(private readonly s3Service: S3Service) {}

  @ApiTags('upload')
  @Post('upload')
  @ApiOperation({ summary: 'Subir un archivo a S3' })
  @ApiResponse({
    status: 201,
    description: 'File uploaded successfully',
  })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Archivo a subir',
    required: true,
    type: 'multipart/form-data',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    return await this.s3Service.uploadFile(file);
  }
}
