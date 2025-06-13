import { Test, TestingModule } from '@nestjs/testing';
import { DynamicEmailService } from './dynamic-email.service';

describe('DynamicEmailService', () => {
  let service: DynamicEmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DynamicEmailService],
    }).compile();

    service = module.get<DynamicEmailService>(DynamicEmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
