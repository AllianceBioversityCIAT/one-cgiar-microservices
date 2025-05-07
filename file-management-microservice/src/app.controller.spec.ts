import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import { ResponseUtils } from './utils/response.utils';
import { HttpStatus } from '@nestjs/common';

describe('AppService', () => {
  let service: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppService],
    }).compile();

    service = module.get<AppService>(AppService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHello', () => {
    it('should return a formatted response with a welcome message', () => {
      const expectedResult = ResponseUtils.format({
        data: 'Welcome to the File Management Microservice!',
        description:
          'The File Management Microservice is running for CGIAR applications.',
        status: HttpStatus.OK,
      });

      const result = service.getHello();

      expect(result).toEqual(expectedResult);
    });
  });
});
