import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'API for Text Mining' })
  @ApiResponse({
    status: 201,
    description: 'The server is running.',
  })
  getHello(): string {
    return this.appService.getHello();
  }
}
