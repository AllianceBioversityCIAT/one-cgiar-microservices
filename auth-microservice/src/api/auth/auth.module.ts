import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { CognitoService } from './cognito/cognito.service';
import { MisService } from './mis/mis.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  controllers: [AuthController],
  imports: [HttpModule],
  providers: [AuthService, CognitoService, MisService],
})
export class AuthModule {}
