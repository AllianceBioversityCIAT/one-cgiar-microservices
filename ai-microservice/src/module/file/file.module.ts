import { Module } from '@nestjs/common';
import { FileService } from './file.service';
import { OpenaiService } from '../openai/openai.service';

@Module({
  providers: [FileService, OpenaiService],
  exports: [FileService],
})
export class FileModule {}
