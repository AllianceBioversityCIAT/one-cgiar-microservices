import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { env } from 'process';
import { ResponseUtils } from '../../utils/response.utils';
import {
  UploadFileDto,
  FileValidationDto,
} from './dto/upload-file-managment.dto';
import { Readable } from 'stream';
import { NotificationsService } from '../notifications/notifications.service';
import { SubscribeApplicationDto } from './dto/subscribe-application.dto';
import { ClarisaService } from '../../tools/clarisa/clarisa.service';

import { PDFDocument } from 'pdf-lib';
import * as mammoth from 'mammoth';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

@Injectable()
export class FileManagementService {
  private readonly interval: number = 3000;
  private readonly maxAttempts: number = 6;

  private readonly _logger = new Logger(FileManagementService.name);
  private readonly s3Client: S3Client;

  constructor(
    private readonly _notificationsService: NotificationsService,
    private readonly _clarisaService: ClarisaService,
  ) {
    this.s3Client = new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  async uploadFile(
    file: Express.Multer.File,
    uploadFileDto: UploadFileDto,
  ): Promise<ResponseUtils> {
    const { bucketName, pageLimit, weightLimit } = uploadFileDto;
    const fileName = uploadFileDto.fileName || file?.originalname;

    if (!file || !bucketName) {
      return this.badRequest('File and bucketName are required');
    }

    if (weightLimit && file.size > weightLimit) {
      return this.badRequest(
        `File size exceeds the limit of ${weightLimit} bytes`,
        `File size (${file.size} bytes) exceeds the limit (${weightLimit} bytes)`,
        'warn',
      );
    }

    const extension = path.extname(fileName).toLowerCase();
    const allowed = [
      '.pdf',
      '.txt',
      '.doc',
      '.docx',
      '.xls',
      '.xlsx',
      '.ppt',
      '.pptx',
    ];

    if (!allowed.includes(extension)) {
      return this.badRequest(
        `File type ${extension} is not allowed. Allowed types: PDF, TXT, DOC, DOCX, XLS, XLSX, PPT, PPTX`,
        `File type ${extension} is not allowed`,
        'warn',
      );
    }

    let pageCount: number | null = null;
    if (pageLimit && ['.pdf', '.doc', '.docx'].includes(extension)) {
      pageCount = await this.safeCountPages(file, extension);
      if (pageCount > pageLimit) {
        return this.badRequest(
          `Document has ${pageCount} pages, which exceeds the limit of ${pageLimit} pages`,
          `Document page count limit exceeded`,
          'warn',
        );
      }
    }

    try {
      const location = await this.uploadToS3(bucketName, fileName, file);
      const pageCountText = pageCount ? `, ${pageCount} pages` : '';
      await this.notifySlack(
        ':file_folder:',
        'File Upload Successful',
        `File "${fileName}" (${file.size} bytes${pageCountText}) successfully uploaded to bucket "${bucketName}"`,
        'Low',
      );

      return ResponseUtils.format({
        data: {
          filename: fileName,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          pageCount,
          location,
        },
        description: 'File uploaded successfully',
        status: HttpStatus.CREATED,
      });
    } catch (err) {
      this._logger.error(`Error uploading file: ${err}`);
      await this.notifySlack(
        ':x:',
        'File Upload Error',
        `Failed to upload file "${fileName}" to bucket "${bucketName}". Error: ${err.message}`,
        'High',
      );
      return ResponseUtils.format({
        data: null,
        description: `Error uploading file: ${err.message}`,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  }

  private badRequest(
    description: string,
    logMessage?: string,
    level: 'warn' | 'error' = 'error',
  ): ResponseUtils {
    if (level === 'warn') this._logger.warn(logMessage || description);
    else this._logger.error(logMessage || description);
    return ResponseUtils.format({
      data: null,
      description,
      status: HttpStatus.BAD_REQUEST,
    });
  }

  private async safeCountPages(
    file: Express.Multer.File,
    extension: string,
  ): Promise<number> {
    try {
      if (extension === '.pdf') {
        const pdf = await PDFDocument.load(file.buffer);
        return pdf.getPageCount();
      }
      const tempPath = path.join(os.tmpdir(), `temp_${Date.now()}${extension}`);
      await fs.promises.writeFile(tempPath, file.buffer);
      const { value: html } = await mammoth.convertToHtml({ path: tempPath });
      await fs.promises.unlink(tempPath).catch(() => {});
      const charsPerPage = 3000;
      return Math.ceil(html.length / charsPerPage);
    } catch (err) {
      this._logger.warn(`Could not count pages: ${err.message}`);
      throw new Error(
        `Unable to verify page count against limit: ${err.message}`,
      );
    }
  }

  private async uploadToS3(
    bucket: string,
    key: string,
    file: Express.Multer.File,
  ): Promise<string> {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );
    return `https://${bucket}.s3.amazonaws.com/${key}`;
  }

  private async notifySlack(
    icon: string,
    title: string,
    message: string,
    severity: 'Low' | 'High',
  ): Promise<void> {
    await this._notificationsService.sendSlackNotification(
      icon,
      'File Management Microservice',
      severity === 'High' ? '#FF0000' : '#4CAF50',
      title,
      message,
      severity,
    );
  }

  async fileValidation(fileValidationDto: FileValidationDto) {
    const { bucketName, key } = fileValidationDto;
    if (!bucketName || !key) {
      this._logger.error('Bucket name and key are required');
      return ResponseUtils.format({
        data: null,
        description: 'Bucket name and key are required',
        status: HttpStatus.BAD_REQUEST,
      });
    }
    this._logger.log(`Validating file ${key} in bucket ${bucketName}`);
    const input = {
      Bucket: bucketName,
      Key: key,
    };

    for (let attempts = 0; attempts < this.maxAttempts; attempts++) {
      try {
        const command = new GetObjectCommand(input);
        const { Body } = await this.s3Client.send(command);

        if (!Body) this._logger.error(`File not found: ${key}`);

        if (Body instanceof Readable) {
          const fileUrl = `https://${bucketName}.s3.amazonaws.com/${key}`;
          this._logger.log(`File found: streaming the file ${key}`);
          return {
            data: fileUrl,
            description: 'File successfully validated and retrieved as url',
            status: HttpStatus.CREATED,
          };
        }
      } catch (error) {
        this._logger.warn(
          `Attempt ${attempts + 1} - The PDF was not generated and uploaded: ${error.message}`,
        );
        if (attempts < this.maxAttempts - 1) {
          await this.delay(this.interval);
        }
      }
    }
    this._logger.error('Max attempts reached. PDF generation failed.');
    await this._notificationsService.sendSlackNotification(
      ':report:',
      'File Management Microservice',
      '#FF0000',
      'Error to retrieve PDF',
      `Max attempts reached. PDF generation failed for s3://${bucketName}/${key}`,
      'High',
    );
    return ResponseUtils.format({
      data: null,
      description: 'Max attempts reached. PDF generation failed',
      errors: `Max attempts reached. PDF generation failed for s3://${bucketName}/${key}`,
      status: HttpStatus.CREATED,
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async deleteFile(fileValidationDto: FileValidationDto): Promise<void> {
    const { bucketName, key } = fileValidationDto;

    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      }),
    );
    this._logger.debug(`File ${key} deleted from bucket ${bucketName}`);
  }

  async subscribeApplication(newApplication: SubscribeApplicationDto) {
    try {
      const newApp = await this._clarisaService.createConnection({
        acronym: newApplication.acronym,
        environment: newApplication.environment,
      });

      return ResponseUtils.format({
        description: 'Application subscribed successfully',
        data: newApp,
        status: HttpStatus.CREATED,
      });
    } catch (error) {
      this._logger.error(`Error subscribing application: ${error}`);
      this._notificationsService.sendSlackNotification(
        ':report:',
        'Reports Microservice - PDF',
        '#FF0000',
        'Error notification details',
        `Error subscribing application: ${error}`,
        'High',
      );
      return ResponseUtils.format({
        description: `Error subscribing application: ${error}`,
        data: null,
        status: HttpStatus.BAD_REQUEST,
      });
    }
  }
}
