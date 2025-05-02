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
    try {
      const { fileName, bucketName, pageLimit, weightLimit } = uploadFileDto;

      if (!file || !fileName || !bucketName) {
        this._logger.error('File, fileName and bucketName are required');
        return ResponseUtils.format({
          data: null,
          description: 'File, fileName and bucketName are required',
          status: HttpStatus.BAD_REQUEST,
        });
      }

      if (weightLimit && file.size > weightLimit) {
        this._logger.warn(
          `File size (${file.size} bytes) exceeds the limit (${weightLimit} bytes)`,
        );
        return ResponseUtils.format({
          data: null,
          description: `File size exceeds the limit of ${weightLimit} bytes`,
          status: HttpStatus.BAD_REQUEST,
        });
      }

      let pageCount = null;
      const fileExtension = path.extname(fileName).toLowerCase();

      if (pageLimit && ['.pdf', '.doc', '.docx'].includes(fileExtension)) {
        try {
          if (fileExtension === '.pdf') {
            const pdfDoc = await PDFDocument.load(file.buffer);
            pageCount = pdfDoc.getPageCount();
            this._logger.debug('PDF page count:', pageCount);
          } else if (fileExtension === '.doc' || fileExtension === '.docx') {
            const tempDir = os.tmpdir();
            const tempFilePath = path.join(
              tempDir,
              `temp_${Date.now()}${fileExtension}`,
            );

            await fs.promises.writeFile(tempFilePath, file.buffer);

            try {
              const result = await mammoth.convertToHtml({
                path: tempFilePath,
              });
              const htmlContent = result.value;

              const charsPerPage = 3000;
              pageCount = Math.ceil(htmlContent.length / charsPerPage);
              this._logger.debug('Word page count:', pageCount);
            } finally {
              await fs.promises.unlink(tempFilePath).catch(() => {});
            }
          }

          if (pageCount && pageCount > pageLimit) {
            this._logger.warn(
              `Document has ${pageCount} pages, which exceeds the limit of ${pageLimit} pages`,
            );
            return ResponseUtils.format({
              data: null,
              description: `Document has ${pageCount} pages, which exceeds the limit of ${pageLimit} pages`,
              status: HttpStatus.BAD_REQUEST,
            });
          }
        } catch (pageCountError) {
          this._logger.warn(`Could not count pages: ${pageCountError.message}`);
          this._logger.warn(
            'Unable to verify page count against limit, rejecting upload for safety',
          );
          return ResponseUtils.format({
            data: null,
            description: `Unable to verify page count against limit: ${pageCountError.message}`,
            status: HttpStatus.BAD_REQUEST,
          });
        }
      }

      const key: string = fileName;
      const uploadParams = {
        Bucket: bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      };

      await this.s3Client.send(new PutObjectCommand(uploadParams));

      await this._notificationsService.sendSlackNotification(
        ':file_folder:',
        'File Management Microservice',
        '#4CAF50',
        'File Upload Successful',
        `File "${fileName}" (${file.size} bytes, ${file.mimetype}${pageCount ? ', ' + pageCount + ' pages' : ''}) successfully uploaded to bucket "${bucketName}"`,
        'Low',
      );

      return ResponseUtils.format({
        data: {
          filename: fileName,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          pageCount: pageCount,
          location: `https://${bucketName}.s3.amazonaws.com/${key}`,
        },
        description: 'File uploaded successfully',
        status: HttpStatus.CREATED,
      });
    } catch (error) {
      this._logger.error(`Error uploading file: ${error}`);
      await this._notificationsService.sendSlackNotification(
        ':x:',
        'File Management Microservice',
        '#FF0000',
        'File Upload Error',
        `Failed to upload file "${uploadFileDto?.fileName}" to bucket "${uploadFileDto?.bucketName}". Error: ${error.message}`,
        'High',
      );
      return ResponseUtils.format({
        data: null,
        description: `Error uploading file: ${error.message}`,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }
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
