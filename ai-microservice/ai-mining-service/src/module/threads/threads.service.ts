import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CreateThreadDto } from './dto/create-thread.dto';
import { OpenaiService } from '../openai/openai.service';
import { ResponseUtils } from '../../utils/response.utils';

@Injectable()
export class ThreadsService {
  private _logger = new Logger(ThreadsService.name);

  constructor(private readonly _openaiService: OpenaiService) {}

  async create() {
    try {
      this._logger.log('Creating thread');
      const messageThread =
        await this._openaiService.openai.beta.threads.create();

      this._logger.log(`Thread created successfully ${messageThread.id}`);
      return ResponseUtils.format({
        data: messageThread,
        description: 'Thread created successfully',
        status: HttpStatus.CREATED,
      });
    } catch (error) {
      return ResponseUtils.format({
        data: null,
        description: 'Error creating thread',
        errors: error,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  }

  async retrieve(threadId: string) {
    try {
      if (!threadId) {
        return ResponseUtils.format({
          data: null,
          description: 'Missing thread ID',
          status: HttpStatus.BAD_REQUEST,
          errors: 'Some required fields are missing',
        });
      }

      const myThread =
        await this._openaiService.openai.beta.threads.retrieve(threadId);

      return ResponseUtils.format({
        data: myThread,
        description: 'Thread retrieved successfully',
        status: HttpStatus.ACCEPTED,
      });
    } catch (error) {
      this._logger.error(error);
      return ResponseUtils.format({
        data: null,
        description: 'Error retrieving thread',
        errors: error,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  }

  async delete(threadId: string) {
    try {
      if (!threadId) {
        return ResponseUtils.format({
          data: null,
          description: 'Missing thread ID',
          status: HttpStatus.BAD_REQUEST,
          errors: 'Some required fields are missing',
        });
      }

      const response =
        await this._openaiService.openai.beta.threads.del(threadId);

      return ResponseUtils.format({
        data: response,
        description: 'Thread deleted successfully',
        status: HttpStatus.OK,
      });
    } catch (error) {
      this._logger.error(error);
      return ResponseUtils.format({
        data: null,
        description: 'Error deleting thread',
        errors: error,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  }
}
