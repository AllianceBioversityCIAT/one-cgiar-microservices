import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ServiceResponseDto } from './domain/shared/global-dto/service-response.dto';
import { HttpStatus } from '@nestjs/common';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: {
            getHello: jest.fn(),
            slackNotification: jest.fn(),
          },
        },
      ],
    }).compile();

    appController = module.get<AppController>(AppController);
    appService = module.get<AppService>(AppService);
  });

  describe('getHello', () => {
    it('should return a welcome message', () => {
      const expectedResponse: ServiceResponseDto<string> = {
        data: 'Welcome to the Reports Microservice!',
        description:
          'The Reports Microservice is running for CGIAR applications.',
        status: HttpStatus.OK,
      };

      jest.spyOn(appService, 'getHello').mockReturnValue(expectedResponse);

      const response = appController.getHello();

      expect(response).toEqual(expectedResponse);
      expect(appService.getHello).toHaveBeenCalled();
    });
  });

  describe('slackNotification', () => {
    it('should send a Slack notification and return a success response', () => {
      const expectedResponse: ServiceResponseDto<string> = {
        data: 'Slack notification sent successfully!',
        description: 'The Slack notification was sent successfully.',
        status: HttpStatus.OK,
      };

      jest
        .spyOn(appService, 'slackNotification')
        .mockReturnValue(expectedResponse);

      const response = appController.slackNotification();

      expect(response).toEqual(expectedResponse);
      expect(appService.slackNotification).toHaveBeenCalled();
    });
  });
});
