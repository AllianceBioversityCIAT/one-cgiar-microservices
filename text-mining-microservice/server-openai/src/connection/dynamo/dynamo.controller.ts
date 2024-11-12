import { Controller } from '@nestjs/common';
import { DynamoService } from './dynamo.service';

@Controller('dynamo')
export class DynamoController {
  constructor(private readonly dynamoService: DynamoService) {}
}
