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
import { AuthInterceptor } from '../../shared/interceptors/microservice.intercetor';

@Controller()
export class MiningController {
  constructor(private readonly miningService: MiningService) {}

  @MessagePattern('mining-create')
  @UseInterceptors(AuthInterceptor)
  async create(@Payload() dataMining: CreateMiningDto) {
    return this.miningService.createMining(dataMining, dataMining.fileData);
  }

  @Post('mining-create')
  @UseInterceptors(AuthInterceptor)
  @UseInterceptors(FileInterceptor('fileUpload'))
  createApi(
    @Body() dataMining: CreateMiningDto,
    @UploadedFile() fileUpload?: Express.Multer.File,
  ) {
    return this.miningService.createMining(dataMining, fileUpload);
  }

  @Post('subscribe-application')
  async subscribeApplication(@Body() newApplication: SubscribeApplicationDto) {
    return await this.miningService.subscribeApplication(newApplication);
  }
}
