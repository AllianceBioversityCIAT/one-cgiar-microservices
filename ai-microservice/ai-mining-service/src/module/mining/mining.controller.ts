import { Body, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { MiningService } from './mining.service';
import { CreateMiningDto } from './dto/create-mining.dto';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller()
export class MiningController {
  constructor(private readonly miningService: MiningService) {}

  @MessagePattern({ cmd: 'mining-create' })
  create(
    @Payload() dataMining: CreateMiningDto,
    @Payload() file: Express.Multer.File,
  ) {
    return this.miningService.createMining(dataMining, file);
  }

  @Post('mining-create')
  @UseInterceptors(FileInterceptor('file'))
  createApi(
    @Body() dataMining: CreateMiningDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.miningService.createMining(dataMining, file);
  }
}
