import { Controller, Get, HttpStatus, Req } from '@nestjs/common';
import { AppService } from './app.service';
import { ResponseUtils } from './domain/shared/utils/response.utils';
import { Request } from 'express';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  mainPage(@Req() req: Request) {
    return ResponseUtils.format({
      description: 'Notification Microservice',
      status: HttpStatus.OK,
      data: {
        message: 'Welcome to the Notification Microservice',
        author: 'One CGIAR - IBD',
        ip: req.ip,
        client: req.headers['user-agent'],
      },
    });
  }
}
