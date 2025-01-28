import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreatePdfDto } from './dto/create-pdf.dto';
import { ResponseUtils } from '../../utils/response.utils';
import { create as createPDF } from 'pdf-creator-node';
import { ReadStream } from 'fs';
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { NotificationsService } from '../notifications/notifications.service';
import { FileManagementService } from '../file-management/file-management.service';

@Injectable()
export class PdfService {
  private readonly _logger = new Logger(PdfService.name);
  private readonly s3Client: S3Client;

  constructor(
    private readonly _notificationsService: NotificationsService,
    private readonly _fileManagementService: FileManagementService,
    private readonly configService: ConfigService,
  ) {
    this.s3Client = new S3Client({
      region: this.configService.get<string>('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get<string>(
          'AWS_SECRET_ACCESS_KEY',
        ),
      },
    });
  }

  async generatePdf(createPdfDto: CreatePdfDto) {
    try {
      const { data, templateData, options, fileName, bucketName } =
        createPdfDto;

      if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        const errorMessage = `The "data" field must be a valid JSON object in ${fileName}.`;
        this._logger.error(errorMessage);
        throw new Error(errorMessage);
      }

      if (typeof templateData !== 'string') {
        const errorMessage = `The "HTML Template" field must be a string or template string in ${fileName}.`;
        this._logger.error(errorMessage);
        throw new Error(errorMessage);
      }

      const document = {
        html: templateData,
        data: data,
        type: 'stream',
      };

      this._logger.debug('Generating PDF...');
      const pdfStream: ReadStream = await createPDF(document, options);
      const pdfBuffer = await this.streamToBuffer(pdfStream);

      const s3Upload = await this.s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: fileName,
          Body: pdfBuffer,
          ContentType: 'application/pdf',
        }),
      );

      if (s3Upload) {
        this._logger.debug(
          `PDF file generated: ${fileName} and uploaded to S3 Bucket: ${bucketName} successfully`,
        );
      }

      const fetchFile = await this._fileManagementService.fileValidation({
        bucketName: bucketName,
        key: fileName,
      });

      await this._notificationsService.sendSlackNotification(
        ':report:',
        'Reports Microservice - PDF',
        '#36a64f',
        'PDF file generated successfully',
        `PDF file generated successfully: ${fileName} and uploaded to S3 Bucket: ${bucketName} successfully`,
        'Low',
      );
      return ResponseUtils.format({
        data: fetchFile.data,
        description: 'PDF file generated successfully',
        status: HttpStatus.CREATED,
      });
    } catch (error) {
      const errorMessage = `Error generating PDF: ${error.message}`;
      this._logger.error(errorMessage, error.stack);
      await this._notificationsService.sendSlackNotification(
        ':report:',
        'Reports Microservice - PDF',
        '#FF0000',
        'Error generating PDF',
        errorMessage,
        'High',
      );
      throw new Error(errorMessage);
    }
  }

  public streamToBuffer(stream: ReadStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', (err) => reject(err));
    });
  }

  async checkFileExists(
    bucketName: string,
    fileName: string,
  ): Promise<boolean> {
    try {
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: bucketName,
          Key: fileName,
        }),
      );
      this._logger.debug(`File ${fileName} exists in bucket ${bucketName}`);
      return true;
    } catch (error) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }
}
