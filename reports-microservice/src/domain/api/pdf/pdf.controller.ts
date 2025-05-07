import { Body, Controller, Post, UseInterceptors } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PdfService } from './pdf.service';
import { CreatePdfDto } from './dto/create-pdf.dto';
import { SubscribeApplicationDto } from './dto/subscribe-application.dto';
import { ApiTags } from '@nestjs/swagger';
import { AuthInterceptor } from '../../shared/interceptors/microservice.intercetor';

@ApiTags('Generate PDF')
@Controller()
export class PdfController {
  constructor(private readonly pdfService: PdfService) {}

  @Post('generate')
  async generatePdfHttpNode(@Body() createPdfDto: CreatePdfDto) {
    return await this.pdfService.generatePdf(createPdfDto);
  }

  @MessagePattern('pdf.generate')
  @UseInterceptors(AuthInterceptor)
  async generatePdfNode(@Payload() createPdfDto: CreatePdfDto) {
    return await this.pdfService.generatePdf(createPdfDto);
  }

  @Post('subscribe-application')
  async subscribeApplication(@Body() newApplication: SubscribeApplicationDto) {
    return await this.pdfService.subscribeApplication(newApplication);
  }
}
