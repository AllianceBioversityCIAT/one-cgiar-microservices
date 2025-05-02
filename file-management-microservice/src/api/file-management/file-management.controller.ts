import {
  Controller,
  Post,
  Body,
  Delete,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileManagementService } from './file-management.service';
import { Express } from 'express';
import {
  FileValidationDto,
  UploadFileDto,
} from './dto/upload-file-managment.dto';
import {
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ResponseUtils } from '../../utils/response.utils';
import { SubscribeApplicationDto } from './dto/subscribe-application.dto';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('File Management')
@Controller()
export class FileManagementController {
  constructor(private readonly fileManagementService: FileManagementService) {}

  @ApiOperation({ summary: 'Upload a file to S3' })
  @ApiHeader({
    name: 'auth',
    description:
      'Basic authentication as a JSON string: {"username": "your_username", "password": "your_password"}',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'File successfully uploaded to S3.',
  })
  @ApiResponse({
    status: 400,
    description: 'Bucket name and file are required.',
  })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File to upload',
        },
        bucketName: {
          type: 'string',
          description: 'S3 bucket name',
        },
        fileName: {
          type: 'string',
          description:
            'Custom name to save the file as (optional, defaults to original filename)',
        },
        pageLimit: {
          type: 'number',
          description: 'Maximum number of pages allowed for PDF/DOC/DOCX files',
        },
        weightLimit: {
          type: 'number',
          description: 'Maximum file size in bytes',
        },
      },
      required: ['file', 'bucketName'],
    },
  })
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() createFileManagmentDto: UploadFileDto,
  ) {
    return await this.fileManagementService.uploadFile(
      file,
      createFileManagmentDto,
    );
  }

  @ApiOperation({ summary: 'Validate and retrieve a file from S3' })
  @ApiHeader({
    name: 'auth',
    description:
      'Basic authentication as a JSON string: {"username": "your_username", "password": "your_password"}',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'File successfully validated and retrieved as a stream.',
  })
  @ApiResponse({
    status: 400,
    description: 'Bucket name and key are required.',
  })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  @Post('validation')
  async validateFile(
    @Body() fileValidationDto: FileValidationDto,
  ): Promise<ResponseUtils> {
    return await this.fileManagementService.fileValidation(fileValidationDto);
  }

  @ApiOperation({ summary: 'Delete a file from S3' })
  @ApiHeader({
    name: 'auth',
    description:
      'Basic authentication as a JSON string: {"username": "your_username", "password": "your_password"}',
    required: true,
  })
  @Delete('delete')
  async deleteFile(@Body() fileValidationDto: FileValidationDto) {
    return await this.fileManagementService.deleteFile(fileValidationDto);
  }

  @Post('subscribe-application')
  async subscribeApplication(@Body() newApplication: SubscribeApplicationDto) {
    return await this.fileManagementService.subscribeApplication(
      newApplication,
    );
  }

  @ApiOperation({ summary: 'Upload a file to S3 using STAR authentication' })
  @ApiHeader({
    name: 'access-token',
    description: 'STAR access token for authentication and authorization',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'File successfully uploaded to S3.',
  })
  @ApiResponse({
    status: 400,
    description: 'Bucket name and file are required.',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired STAR token.',
  })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File to upload',
        },
        bucketName: {
          type: 'string',
          description: 'S3 bucket name',
        },
        fileName: {
          type: 'string',
          description:
            'Custom name to save the file as (optional, defaults to original filename)',
        },
        pageLimit: {
          type: 'number',
          description: 'Maximum number of pages allowed for PDF/DOC/DOCX files',
        },
        weightLimit: {
          type: 'number',
          description: 'Maximum file size in bytes',
        },
      },
      required: ['file', 'bucketName'],
    },
  })
  @Post('upload-file')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() createFileManagmentDto: UploadFileDto,
  ) {
    return await this.fileManagementService.uploadFile(
      file,
      createFileManagmentDto,
    );
  }
}
