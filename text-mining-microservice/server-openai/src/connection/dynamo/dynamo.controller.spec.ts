import { Test, TestingModule } from '@nestjs/testing';
import { DynamoController } from './dynamo.controller';
import { DynamoService } from './dynamo.service';

describe('DynamoController', () => {
  let controller: DynamoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DynamoController],
      providers: [DynamoService],
    }).compile();

    controller = module.get<DynamoController>(DynamoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
