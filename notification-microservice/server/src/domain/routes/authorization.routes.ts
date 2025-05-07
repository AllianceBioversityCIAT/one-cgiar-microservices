import { RouteTree } from '@nestjs/core';
import { MailerModule } from '../api/mailer/mailer.module';

export const routes: RouteTree = {
  path: 'email',
  module: MailerModule,
};
