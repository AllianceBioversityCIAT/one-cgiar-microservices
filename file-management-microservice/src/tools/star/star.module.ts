import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { StarService } from './star.service';

@Module({
  imports: [HttpModule],
  providers: [StarService],
  exports: [StarService],
})
export class StarModule {}
