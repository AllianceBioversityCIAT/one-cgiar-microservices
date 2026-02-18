import { HttpStatus } from '@nestjs/common';
import { PdfController } from './pdf.controller';
import { PdfService } from './pdf.service';
import { CreatePdfDto } from './dto/create-pdf.dto';
import { CreatePdfUrlDto } from './dto/create-pdf-url.dto';
import { SubscribeApplicationDto } from './dto/subscribe-application.dto';
import { ResponseUtils } from '../../utils/response.utils';

describe('PdfController', () => {
  let controller: PdfController;
  let pdfService: jest.Mocked<PdfService>;

  beforeEach(() => {
    pdfService = {
      generatePdf: jest.fn(),
      generatePdfFromUrl: jest.fn(),
      subscribeApplication: jest.fn(),
    } as unknown as jest.Mocked<PdfService>;
    controller = new PdfController(pdfService);
  });

  describe('generatePdfHttpNode', () => {
    it('should call service.generatePdf and return result', async () => {
      const dto: CreatePdfDto = {
        data: {},
        templateData: '<p>Hi</p>',
        options: {},
        bucketName: 'b',
        fileName: 'f.pdf',
      };
      const url = 'https://b.s3.amazonaws.com/f.pdf';
      pdfService.generatePdf.mockResolvedValueOnce(url);

      const result = await controller.generatePdfHttpNode(dto);

      expect(pdfService.generatePdf).toHaveBeenCalledWith(dto);
      expect(result).toBe(url);
    });
  });

  describe('generatePdfFromUrlHttp', () => {
    it('should call service.generatePdfFromUrl and return formatted response', async () => {
      const dto: CreatePdfUrlDto = {
        data: { id: 1 },
        templateName: '001',
        bucketName: 'bucket',
        fileName: 'out.pdf',
      };
      const fileUrl = 'https://bucket.s3.amazonaws.com/out.pdf';
      pdfService.generatePdfFromUrl.mockResolvedValueOnce(fileUrl);

      const result = await controller.generatePdfFromUrlHttp(dto);

      expect(pdfService.generatePdfFromUrl).toHaveBeenCalledWith(dto);
      expect(result).toEqual(
        ResponseUtils.format({
          description: 'PDF generated and uploaded successfully',
          status: HttpStatus.OK,
          data: { url: fileUrl },
        }),
      );
    });
  });

  describe('generatePdfNode', () => {
    it('should call service.generatePdf with payload', async () => {
      const dto: CreatePdfDto = {
        data: {},
        templateData: '<p>Hi</p>',
        options: {},
        bucketName: 'b',
        fileName: 'f.pdf',
      };
      pdfService.generatePdf.mockResolvedValueOnce('https://b.s3.amazonaws.com/f.pdf');

      const result = await controller.generatePdfNode(dto);

      expect(pdfService.generatePdf).toHaveBeenCalledWith(dto);
      expect(result).toBe('https://b.s3.amazonaws.com/f.pdf');
    });
  });

  describe('generatePdfFromUrlNode', () => {
    it('should call service.generatePdfFromUrl and return { url }', async () => {
      const dto: CreatePdfUrlDto = {
        data: {},
        templateName: '001',
        bucketName: 'b',
        fileName: 'f.pdf',
      };
      const fileUrl = 'https://b.s3.amazonaws.com/f.pdf';
      pdfService.generatePdfFromUrl.mockResolvedValueOnce(fileUrl);

      const result = await controller.generatePdfFromUrlNode(dto);

      expect(pdfService.generatePdfFromUrl).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ url: fileUrl });
    });
  });

  describe('subscribeApplication', () => {
    it('should call service.subscribeApplication and return result', async () => {
      const dto: SubscribeApplicationDto = {
        acronym: 'APP',
        environment: 'dev',
      };
      const serviceResult = {
        description: 'Application subscribed successfully',
        data: { id: 1 },
        status: HttpStatus.CREATED,
      };
      pdfService.subscribeApplication.mockResolvedValueOnce(serviceResult);

      const result = await controller.subscribeApplication(dto);

      expect(pdfService.subscribeApplication).toHaveBeenCalledWith(dto);
      expect(result).toEqual(serviceResult);
    });
  });
});
