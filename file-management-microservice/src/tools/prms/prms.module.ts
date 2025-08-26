import { Module } from '@nestjs/common';
import { PrmsService } from './prms.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  providers: [PrmsService],
  exports: [PrmsService],
})
export class PrmsModule {}
