import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CreateMiningDto } from './dto/create-mining.dto';
import { ResponseUtils } from '../../utils/response.utils';
import { OpenaiService } from '../openai/openai.service';
import { ThreadsService } from '../threads/threads.service';
import { AssistantService } from '../assistant/assistant.service';
import { MessagesService } from '../messages/messages.service';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../../notifications/notifications.service';

@Injectable()
export class MiningService {
  private _logger = new Logger(MiningService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly _notificationsService: NotificationsService,
    private readonly _assistantService: AssistantService,
    private readonly _threadsService: ThreadsService,
    private readonly _messageService: MessagesService,
  ) {}

  async createMining(
    createMiningDto: CreateMiningDto,
    file: Express.Multer.File,
  ) {
    try {
      const { role, tool } = createMiningDto;
      const assistantId = this.configService.get<string>('ASSISTANT_ID');

      const content = `Analyze the attached document to extract innovations.`;

      await this._assistantService.findOne(assistantId);
      const newThread = await this._threadsService.create();
      const newMessage = await this._messageService.create(
        {
          assistantId,
          threadId: newThread.data.id,
          role,
          tool,
          content,
        },
        file,
      );

      let parsedData;
      if (typeof newMessage.data === 'string') {
        try {
          parsedData = JSON.parse(newMessage.data);
        } catch (parseError) {
          throw new Error('Failed to parse newMessage.data to JSON: ' + parseError.message);
        }
      } else {
        parsedData = newMessage.data;
      }

      this._logger.log('Mining complete successfully');
      this._notificationsService.sendSlackNotification(
        ':hammer:',
        'AI ROAR - Mining complete successfully',
        '#03FF00',
        'Mining for user Test complete successfully',
        '',
        'High',
      )
      return ResponseUtils.format({
        data: parsedData,
        description: 'Mining complete successfully',
        status: HttpStatus.CREATED,
      });
    } catch (error) {
      this._notificationsService.sendSlackNotification(
        ':warning:',
        'AI ROAR - Error extracting results from document',
        'danger',
        'Error creating mining',
        error.message,
        'High',
      )
      this._logger.error(error);
      return ResponseUtils.format({
        data: null,
        description: error.message,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  }
}
