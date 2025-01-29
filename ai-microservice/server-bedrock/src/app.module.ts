import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MiningModule } from './aws/mining/mining.module';
import { S3Module } from './aws/s3/s3.module';

@Module({
  imports: [MiningModule, S3Module],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
