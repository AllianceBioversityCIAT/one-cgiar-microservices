import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CreateMessageDto } from './dto/create-message.dto';
import { OpenaiService } from '../openai/openai.service';
import { ResponseUtils } from '../../common/utils/response.utils';

@Injectable()
export class MessagesService {
  private _logger: Logger = new Logger(MessagesService.name);
  constructor(private readonly _openaiService: OpenaiService) {}

  async create(createMessageDto: CreateMessageDto, file: Express.Multer.File) {
    const { assistantId, threadId, role, tool, content } = createMessageDto;
    try {
      const fileName = Date.now() + file.originalname.trim().toLowerCase();

      const fileLike = new File([file.buffer], fileName.trim(), {
        type: file.mimetype,
        lastModified: Date.now(),
      });

      const upload = await this._openaiService.openAI.files.create({
        file: fileLike,
        purpose: 'assistants',
      });

      if (!upload) {
        return ResponseUtils.format({
          data: null,
          description: 'Failed to upload file',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
        });
      }

      if (!upload) {
        throw new Error('Failed to upload file');
      }

      await this._openaiService.openAI.beta.threads.messages.create(threadId, {
        role,
        content,
        attachments: [
          {
            file_id: upload.id,
            tools: [{ type: tool }],
          },
        ],
      });

      const stream = await this._openaiService.openAI.beta.threads.runs.create(
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
}
