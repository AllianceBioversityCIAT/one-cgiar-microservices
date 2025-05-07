import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import { NotificationsService } from './domain/notifications/notifications.service';
import { ServiceResponseDto } from './domain/shared/global-dto/service-response.dto';
import { HttpStatus } from '@nestjs/common';

describe('AppService', () => {
  let appService: AppService;
  let notificationsService: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        {
          provide: NotificationsService,
          useValue: {
            sendSlackNotification: jest.fn(),
          },
        },
      ],
    }).compile();

    appService = module.get<AppService>(AppService);
    notificationsService =
      module.get<NotificationsService>(NotificationsService);
  });

  describe('getHello', () => {
    it('should return a welcome message with proper formatting', () => {
      const expectedResponse: ServiceResponseDto<string> = {
        data: 'Welcome to the Reports Microservice!',
        description:
          'The Reports Microservice is running for CGIAR applications.',
        status: HttpStatus.OK,
      };

      const response = appService.getHello();

      expect(response).toEqual(expectedResponse);
    });
  });

  describe('slackNotification', () => {
    it('should send a Slack notification and return a success response', () => {
      const expectedResponse: ServiceResponseDto<string> = {
        data: 'Slack notification sent successfully!',
        description: 'The Slack notification was sent successfully.',
        status: HttpStatus.OK,
      };

      const response = appService.slackNotification();

      expect(response).toEqual(expectedResponse);
      expect(notificationsService.sendSlackNotification).toHaveBeenCalledWith(
        ':report:',
        'Reports Microservice!',
        '#00FF00',
        'Slack Notification Test',
        'The Slack notification is working.',
        'High',
      );
    });
  });
});
