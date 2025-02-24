import { Module } from '@nestjs/common';
import { ClarisaService } from './clarisa.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  controllers: [],
  providers: [ClarisaService],
  imports: [HttpModule],
  exports: [ClarisaService],
})
export class ClarisaModule {}
