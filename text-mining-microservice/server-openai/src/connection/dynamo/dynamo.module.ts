import { Module } from '@nestjs/common';
import { DynamoService } from './dynamo.service';
import { DynamoController } from './dynamo.controller';

@Module({
  controllers: [DynamoController],
  providers: [DynamoService],
})
export class DynamoModule {}
