import { Injectable, Logger } from '@nestjs/common';
import { OpenaiService } from '../openai/openai.service';

@Injectable()
export class FileService {
  private _logger: Logger = new Logger(FileService.name);

  constructor(private readonly _openaiService: OpenaiService) {}

  public async uploadFile(file: Express.Multer.File) {
    this._logger.log('Uploading file');
    const fileName = `${Date.now()}_${file.originalname.trim().toLowerCase().replace(/\s+/g, '_')}`;

    const normalizedBuffer = Buffer.isBuffer(file.buffer)
      ? file.buffer
      : Buffer.from(file.buffer['data']);

    const upload = await this._openaiService.openai.files.create({
      file: new File([normalizedBuffer], fileName, { type: file.mimetype }),
      purpose: 'assistants',
    });
    this._logger.log(`File uploaded successfully: ${fileName}`);

    if (!upload) {
      throw new Error('Failed to upload file');
    }

    return upload;
  }

  public async deleteFile(fileId: string) {
    try {
      this._logger.log(`Deleting file with ID: ${fileId}`);
      await this._openaiService.openai.files.del(fileId);
      this._logger.log('File deleted successfully');
      return true;
    } catch (error) {
      this._logger.error(`Error deleting file: ${error.message}`);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }
}
