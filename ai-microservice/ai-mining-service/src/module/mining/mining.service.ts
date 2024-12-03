import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CreateMiningDto } from './dto/create-mining.dto';
import { ResponseUtils } from '../../utils/response.utils';
import { OpenaiService } from '../openai/openai.service';
import { ThreadsService } from '../threads/threads.service';
import { AssistantService } from '../assistant/assistant.service';
import { MessagesService } from '../messages/messages.service';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../../notifications/notifications.service';
import { SubscribeApplicationDto } from './dto/subscribe-application.dto';
import { ClarisaService } from '../../tools/clarisa/clarisa.service';

@Injectable()
export class MiningService {
  private _logger = new Logger(MiningService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly _notificationsService: NotificationsService,
    private readonly _assistantService: AssistantService,
    private readonly _threadsService: ThreadsService,
    private readonly _messageService: MessagesService,
    private readonly _clarisaService: ClarisaService,
  ) {}

  async createMining(
    createMiningDto: CreateMiningDto,
    file?: Express.Multer.File,
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
          throw new Error(
            'Failed to parse AI Model Data Response to JSON: ' +
              parseError.message,
          );
        }
      } else {
        parsedData = newMessage.data;
      }

      this._logger.log(`Mining complete successfully: ${parsedData}`);
      this._notificationsService.sendSlackNotification(
        ':hammer:',
        this.configService.get<string>('MS_NAME'),
        '#03FF00',
        'Mining for user complete successfully',
        '',
        'High',
      );
      return ResponseUtils.format({
        data: parsedData,
        description: 'Mining complete successfully',
        status: HttpStatus.CREATED,
      });
    } catch (error) {
      this._notificationsService.sendSlackNotification(
        ':warning:',
        this.configService.get<string>('MS_NAME'),
        'danger',
        'Error extracting results from document',
        error.message,
        'High',
      );
      this._logger.error(error);
      return ResponseUtils.format({
        data: null,
        description: error,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }
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
        this.configService.get<string>('MS_NAME'),
        '#FF0000',
        'Error subscribing application',
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
