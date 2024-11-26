import { Test, TestingModule } from '@nestjs/testing';
import { MiningController } from './mining.controller';
import { MiningService } from './mining.service';

describe('MiningController', () => {
  let controller: MiningController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MiningController],
      providers: [MiningService],
    }).compile();

    controller = module.get<MiningController>(MiningController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
