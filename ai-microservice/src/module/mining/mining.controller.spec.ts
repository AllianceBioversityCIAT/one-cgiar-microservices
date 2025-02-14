import { Test, TestingModule } from '@nestjs/testing';
import { MiningController } from './mining.controller';
import { MiningService } from './mining.service';
import { Test as TestBroker } from '../../tools/broker-connection/test';

describe('MiningController', () => {
  let controller: MiningController;
  let miningService: jest.Mocked<MiningService>;
  let testBroker: jest.Mocked<TestBroker>;

  beforeEach(async () => {
    const mockMiningService = {
      createMining: jest.fn(),
      subscribeApplication: jest.fn(),
    };

    const mockTestBroker = {
      sendToPattern: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MiningController],
      providers: [
        {
          provide: MiningService,
          useValue: mockMiningService,
        },
        {
          provide: TestBroker,
          useValue: mockTestBroker,
        },
      ],
    }).compile();

    controller = module.get<MiningController>(MiningController);
    miningService = module.get(MiningService);
    testBroker = module.get(TestBroker);
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should have MiningService injected', () => {
      expect(controller['miningService']).toBeDefined();
      expect(controller['miningService']).toEqual(miningService);
    });

    it('should have Test broker injected', () => {
      expect(controller['test']).toBeDefined();
      expect(controller['test']).toEqual(testBroker);
    });
  });

  describe('dependency injection edge cases', () => {
    it('should throw error when MiningService is not provided', async () => {
      await expect(
        Test.createTestingModule({
          controllers: [MiningController],
          providers: [
            {
              provide: TestBroker,
              useValue: testBroker,
            },
          ],
        }).compile()
      ).rejects.toThrow();
    });

    it('should throw error when Test broker is not provided', async () => {
      await expect(
        Test.createTestingModule({
          controllers: [MiningController],
          providers: [
            {
              provide: MiningService,
              useValue: miningService,
            },
          ],
        }).compile()
      ).rejects.toThrow();
    });
  });
});