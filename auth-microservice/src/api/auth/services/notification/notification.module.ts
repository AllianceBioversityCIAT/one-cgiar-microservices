import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { env } from 'process';
import { EmailNotificationManagementService } from './notification.service';

@Module({
  providers: [EmailNotificationManagementService],
  imports: [
    ClientsModule.register([
      {
        name: 'EMAIL_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [env.MS_NOTIFICATION_HOST],
          queue: env.MS_NOTIFICATION_QUEUE,
          queueOptions: {
            durable: true,
          },
        },
      },
    ]),
  ],
  exports: [EmailNotificationManagementService],
})
export class EmailNotificationManagementModule {}
