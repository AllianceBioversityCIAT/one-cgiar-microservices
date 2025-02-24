import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CreateMessageDto } from './dto/create-message.dto';
import { OpenaiService } from '../openai/openai.service';
import { ResponseUtils } from '../../utils/response.utils';
import { FileService } from '../file/file.service';

@Injectable()
export class MessagesService {
  private _logger: Logger = new Logger(MessagesService.name);
  constructor(
    private readonly _openaiService: OpenaiService,
    private readonly _fileService: FileService,
  ) {}

  async create(createMessageDto: CreateMessageDto, file: Express.Multer.File) {
    const { assistantId, threadId, role, tool, content } = createMessageDto;
    try {
      this._logger.log('Creating message');
      this._logger.log(`Uploading file: ${file}`);
      if (!file || file === undefined) {
        return ResponseUtils.format({
          data: null,
          description: 'File is required',
          status: HttpStatus.BAD_REQUEST,
        });
      }

      const upload = await this._fileService.uploadFile(file);

      this._logger.log('Creating message');
      await this._openaiService.openai.beta.threads.messages.create(threadId, {
        role,
        content,
        attachments: [
          {
            file_id: upload.id,
            tools: [{ type: tool }],
          },
        ],
      });

      this._logger.log('Message created successfully');
      const stream = await this._openaiService.openai.beta.threads.runs.create(
        threadId,
        {
          assistant_id: assistantId,
          stream: true,
        },
      );

      let finalResult: any[] = [];

      for await (const message of stream) {
        if (message.event === 'thread.message.delta') {
          const content = message.data.delta.content[0];
          if (content && content.type === 'text') {
            console.info(content.text.value);
          }
        }
        if (message.event === 'thread.message.completed') {
          console.log('Completed event detected');
          finalResult = message.data.content;
          break;
        }
      }

      if (finalResult.length > 0) {
        await this._fileService.deleteFile(upload.id);
        this._logger.log('File and storage cleaned up successfully');

        return ResponseUtils.format({
          data: finalResult[0]?.text?.value,
          description: 'Information retrieved successfully',
          status: HttpStatus.CREATED,
        });
      } else {
        return ResponseUtils.format({
          data: null,
          description: 'Failed to get response',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
        });
      }
    } catch (error) {
      this._logger.error(error);
      return ResponseUtils.format({
        data: null,
        description: error.message,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        errors: error,
      });
    }
  }

  async findAll(threadId: string) {
    try {
      const messages =
        await this._openaiService.openai.beta.threads.messages.list(threadId);
      return ResponseUtils.format({
        data: messages,
        description: 'Messages retrieved successfully',
        status: HttpStatus.OK,
      });
    } catch (error) {
      this._logger.error(error);
      return ResponseUtils.format({
        data: null,
        description: error.message,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        errors: error,
      });
    }
  }
}
