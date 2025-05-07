import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ServiceResponseDto } from './domain/shared/global-dto/service-response.dto';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @ApiOperation({ summary: 'Get Welcome to the Reports Microservice' })
  @Get()
  getHello(): ServiceResponseDto<string> {
    return this.appService.getHello();
  }

  @ApiOperation({ summary: 'Test send a notification to Slack' })
  @ApiHeader({
    name: 'auth',
    description:
      'Basic authentication as a JSON string: {"username": "your_username", "password": "your_password"}',
    required: true,
  })
  @Get('test-slack-notification')
  slackNotification(): ServiceResponseDto<string> {
    return this.appService.slackNotification();
  }
}
