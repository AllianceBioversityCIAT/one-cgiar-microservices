import { Body, Controller, Post, UseInterceptors,HttpStatus } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ApiOperation, ApiResponse, ApiBody, ApiTags } from '@nestjs/swagger';
import { PdfService } from './pdf.service';
import { CreatePdfDto } from './dto/create-pdf.dto';
import { CreatePdfUrlDto } from './dto/create-pdf-url.dto';
import { PdfUrlResponseDto } from './dto/pdf-url-response.dto';
import { SubscribeApplicationDto } from './dto/subscribe-application.dto';
import { AuthInterceptor } from '../../shared/interceptors/microservice.intercetor';
import { ResponseUtils } from '../../utils/response.utils';

@ApiTags('Generate PDF')
@Controller()
export class PdfController {
  constructor(private readonly pdfService: PdfService) {}

  @Post('generate')
  async generatePdfHttpNode(@Body() createPdfDto: CreatePdfDto) {
    return await this.pdfService.generatePdf(createPdfDto);
  }

  @Post('generate-url')
  @ApiOperation({ summary: 'Generate PDF from URL template' })
  @ApiBody({ type: CreatePdfUrlDto })
  @ApiResponse({
    status: 200,
    description: 'PDF generated and uploaded successfully',
    type: PdfUrlResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input (template, URL, or validation error)',
  })
  @ApiResponse({ status: 500, description: 'Conversion or storage failure' })
  async generatePdfFromUrlHttp(@Body() dto: CreatePdfUrlDto) {
    const url = await this.pdfService.generatePdfFromUrl(dto);
    return ResponseUtils.format({
      description: 'PDF generated and uploaded successfully',
      status: HttpStatus.OK,
      data: { url },
    });
  }

  @MessagePattern('pdf.generate')
  @UseInterceptors(AuthInterceptor)
  async generatePdfNode(@Payload() createPdfDto: CreatePdfDto) {
    return await this.pdfService.generatePdf(createPdfDto);
  }

  @MessagePattern('pdf.generateUrl')
  @UseInterceptors(AuthInterceptor)
  async generatePdfFromUrlNode(
    @Payload() dto: CreatePdfUrlDto,
  ): Promise<PdfUrlResponseDto> {
    const url = await this.pdfService.generatePdfFromUrl(dto);
    return { url };
  }

  @Post('subscribe-application')
  async subscribeApplication(@Body() newApplication: SubscribeApplicationDto) {
    return await this.pdfService.subscribeApplication(newApplication);
  }
}
