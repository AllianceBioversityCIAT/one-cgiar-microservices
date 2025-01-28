import {
  Controller,
  Post,
  Body,
} from '@nestjs/common';
import { PdfService } from './pdf.service';
import { CreatePdfDto } from './dto/create-pdf.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Generate PDF')
@Controller()
export class PdfController {
  constructor(private readonly pdfService: PdfService) {}

  @Post('generate')
  async generatePdfHttpNode(@Body() createPdfDto: CreatePdfDto) {
    return await this.pdfService.generatePdf(createPdfDto);
  }
}
