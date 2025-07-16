import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MisService } from './mis/mis.service';
import { HttpModule } from '@nestjs/axios';
import { CognitoService } from './services/cognito/cognito.service';
import { EmailNotificationManagementModule } from './services/notification/notification.module';
import { BulkUserService } from './services/bulk-registration/bulk-registration.service';
import { PasswordGeneratorService } from './services/password/password.service';
import { DynamicEmailService } from './services/dynamic-email/dynamic-email.service';
import { UserService } from './services/user/user.service';

@Module({
  controllers: [AuthController],
  imports: [HttpModule, EmailNotificationManagementModule],
  providers: [
    AuthService,
    CognitoService,
    MisService,
    BulkUserService,
    PasswordGeneratorService,
    DynamicEmailService,
    UserService,
  ],
})
export class AuthModule {}
