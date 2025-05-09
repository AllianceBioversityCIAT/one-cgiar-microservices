import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { MiningService } from './mining.service';
import { CreateMiningDto } from './dto/create-mining.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { SubscribeApplicationDto } from './dto/subscribe-application.dto';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { Test } from '../../tools/broker-connection/test';

@Controller()
export class MiningController {
  constructor(
    private readonly miningService: MiningService,
    private readonly test: Test,
  ) {}

  @MessagePattern('mining-create')
  async create(@Payload() dataMining: CreateMiningDto) {
    return this.miningService.createMining(dataMining, dataMining.file);
  }

  @Post('mining-create')
  @UseInterceptors(FileInterceptor('file'))
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
        role: {
          type: 'string',
          description: 'User role for the mining process',
          example: 'user',
        },
        tool: {
          type: 'string',
          description: 'Tool to be used for mining',
          example: 'file_search',
        },
      },
      required: ['file', 'role', 'tool'],
    },
  })
  createApi(
    @Body() dataMining: CreateMiningDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.miningService.createMining(dataMining, file);
  }

  @Post('mining-create-test')
  @UseInterceptors(FileInterceptor('file'))
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
        role: {
          type:'string',
          description: 'User role for the mining process',
          example: 'user',
        },
        tool: {
          type:'string',
          description: 'Tool to be used for mining',
          example: 'file_search',
        },
      },
      required: ['file', 'role', 'tool'],
    },
  })
  createApiTest(@UploadedFile() file?: Express.Multer.File) {
    const json = {
      role: 'user',
      tool: 'file_search',
      file: file,
    };
    return this.test.sendToPattern('mining-create', json);
  }

  @Post('subscribe-application')
  async subscribeApplication(@Body() newApplication: SubscribeApplicationDto) {
    return await this.miningService.subscribeApplication(newApplication);
  }
}
