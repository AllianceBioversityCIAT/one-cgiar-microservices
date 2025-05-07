import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { NotificationsService } from './notifications.service';
import { ResponseUtils } from '../utils/response.utils';

jest.mock('axios');

describe('NotificationsService', () => {
  let notificationsService: NotificationsService;
  let configService: ConfigService;

  beforeEach(() => {
    configService = {
      get: jest.fn().mockReturnValue('http://mock-slack-webhook.com'),
    } as unknown as ConfigService;

    notificationsService = new NotificationsService(configService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendSlackNotification', () => {
    it('should send a successful slack notification', async () => {
      const mockResponse = { data: { success: true } };
      (axios.post as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await notificationsService.sendSlackNotification(
        ':thumbsup:',
        'Test Notification',
        'good',
        'Notification Title',
        'Notification Info',
        'High',
      );

      expect(axios.post).toHaveBeenCalledWith('http://mock-slack-webhook.com', {
        channel: '#microservices-notifications',
        icon_emoji: ':thumbsup:',
        text: 'Test Notification',
        username: 'Reports Microservice',
        attachments: [
          {
            color: 'good',
            title: 'Notification Title',
            text: 'Notification Info',
            fields: [
              {
                title: 'Priority',
                value: 'High',
                short: false,
              },
              {
                title: 'Environment',
                value: 'Development :construction:',
                short: true,
              },
              {
                title: 'Timestamp',
                value: expect.any(String),
                short: true,
              },
            ],
            footer: 'Reports Microservice',
            ts: expect.any(Number),
          },
        ],
      });

      expect(result).toEqual(
        ResponseUtils.format({
          description: 'Notification sent successfully',
          status: 200,
          data: { success: true },
        }),
      );
    });

    it('should handle errors when sending a slack notification', async () => {
      const mockError = new Error('Failed to send notification');
      (axios.post as jest.Mock).mockRejectedValueOnce(mockError);

      const result = await notificationsService.sendSlackNotification(
        ':thumbsup:',
        'Test Notification',
        'good',
        'Notification Title',
        'Notification Info',
        'High',
      );

      expect(axios.post).toHaveBeenCalledWith('http://mock-slack-webhook.com', {
        channel: '#microservices-notifications',
        icon_emoji: ':thumbsup:',
        text: 'Test Notification',
        username: 'Reports Microservice',
        attachments: [
          {
            color: 'good',
            title: 'Notification Title',
            text: 'Notification Info',
            fields: [
              {
                title: 'Priority',
                value: 'High',
                short: false,
              },
              {
                title: 'Environment',
                value: 'Development :construction:',
                short: true,
              },
              {
                title: 'Timestamp',
                value: expect.any(String),
                short: true,
              },
            ],
            footer: 'Reports Microservice',
            ts: expect.any(Number),
          },
        ],
      });

      expect(result).toBeUndefined();
    });
  });
});
