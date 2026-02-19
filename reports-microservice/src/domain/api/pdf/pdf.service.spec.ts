import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import { PdfService } from './pdf.service';
import { ClarisaService } from '../../tools/clarisa/clarisa.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { GotenbergService } from './gotenberg.service';
import { CreatePdfDto } from './dto/create-pdf.dto';
import { CreatePdfUrlDto } from './dto/create-pdf-url.dto';
import { SubscribeApplicationDto } from './dto/subscribe-application.dto';

const mockS3Send = jest.fn();
jest.mock('@aws-sdk/client-s3', () => {
  const createCommand = (input: any) => ({ input });
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: mockS3Send })),
    PutObjectCommand: jest.fn().mockImplementation(createCommand),
    HeadObjectCommand: jest.fn().mockImplementation(createCommand),
  };
});

const mockCreatePDF = jest.fn();
jest.mock('pdf-creator-node', () => ({
  create: (...args: unknown[]) => mockCreatePDF(...args),
}));

describe('PdfService', () => {
  let service: PdfService;
  let clarisaService: jest.Mocked<ClarisaService>;
  let notificationsService: jest.Mocked<NotificationsService>;
  let configService: jest.Mocked<ConfigService>;
  let gotenbergService: jest.Mocked<GotenbergService>;

  const validCreatePdfDto: CreatePdfDto = {
    data: { title: 'Test' },
    templateData: '<p>Hello {{title}}</p>',
    options: {},
    bucketName: 'test-bucket',
    fileName: 'test.pdf',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    configService = {
      get: jest.fn((key: string) => {
        const map: Record<string, string> = {
          AWS_REGION: 'us-east-1',
          AWS_ACCESS_KEY_ID: 'key',
          AWS_SECRET_ACCESS_KEY: 'secret',
        };
        return map[key] ?? '';
      }),
    } as unknown as jest.Mocked<ConfigService>;

    clarisaService = {
      createConnection: jest.fn(),
    } as unknown as jest.Mocked<ClarisaService>;

    notificationsService = {
      sendSlackNotification: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<NotificationsService>;

    gotenbergService = {
      getTemplateBaseUrl: jest
        .fn()
        .mockReturnValue('https://templates.example.com'),
      fetchAstroData: jest.fn().mockResolvedValue({ id: 1 }),
      convertUrlToPdf: jest.fn().mockResolvedValue(Buffer.from('pdf')),
    } as unknown as jest.Mocked<GotenbergService>;

    service = new PdfService(
      clarisaService,
      notificationsService,
      configService,
      gotenbergService,
    );
  });

  describe('streamToBuffer', () => {
    it('should convert a stream to buffer', async () => {
      const stream = Readable.from([Buffer.from('a'), Buffer.from('b')]);
      const result = await service.streamToBuffer(stream as any);
      expect(result).toEqual(Buffer.from('ab'));
    });

    it('should reject on stream error', async () => {
      const stream = new Readable({
        read() {
          this.destroy(new Error('stream error'));
        },
      });
      await expect(service.streamToBuffer(stream as any)).rejects.toThrow(
        'stream error',
      );
    });
  });

  describe('generatePdf', () => {
    it('should throw if data is not a valid object', async () => {
      const dto = { ...validCreatePdfDto, data: null };
      await expect(service.generatePdf(dto)).rejects.toThrow(
        'The "data" field must be a valid JSON object',
      );
      expect(notificationsService.sendSlackNotification).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        '#FF0000',
        'Error generating PDF',
        expect.stringContaining('data'),
        'High',
      );
    });

    it('should throw if data is an array', async () => {
      const dto = { ...validCreatePdfDto, data: [] };
      await expect(service.generatePdf(dto)).rejects.toThrow(
        'The "data" field must be a valid JSON object',
      );
    });

    it('should throw if templateData is not a string', async () => {
      const dto = { ...validCreatePdfDto, templateData: 123 as any };
      await expect(service.generatePdf(dto)).rejects.toThrow(
        'The "HTML Template" field must be a string',
      );
    });

    it('should generate PDF, upload to S3, notify Slack and return URL', async () => {
      const stream = Readable.from([Buffer.from('pdf-content')]);
      mockCreatePDF.mockResolvedValueOnce(stream);
      mockS3Send.mockResolvedValueOnce({});

      const result = await service.generatePdf(validCreatePdfDto);

      expect(mockCreatePDF).toHaveBeenCalled();
      expect(mockS3Send).toHaveBeenCalledTimes(1);
      const cmd = mockS3Send.mock.calls[0][0];
      expect(cmd.input.Bucket).toBe('test-bucket');
      expect(cmd.input.Key).toBe('test.pdf');
      expect(cmd.input.ContentType).toBe('application/pdf');
      expect(notificationsService.sendSlackNotification).toHaveBeenCalledWith(
        ':report:',
        'Reports Microservice - PDF',
        '#36a64f',
        'PDF file generated successfully',
        expect.any(String),
        'Low',
      );
      expect(result).toBe('https://test-bucket.s3.amazonaws.com/test.pdf');
    });

    it('should apply font style when font is provided', async () => {
      const stream = Readable.from([Buffer.from('pdf')]);
      mockCreatePDF.mockResolvedValueOnce(stream);
      mockS3Send.mockResolvedValueOnce({});
      const dto = { ...validCreatePdfDto, font: 'Arial' };

      await service.generatePdf(dto);

      expect(mockCreatePDF).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('font-family: Arial'),
        }),
        expect.anything(),
      );
    });

    it('should notify Slack and rethrow on PDF generation error', async () => {
      mockCreatePDF.mockRejectedValueOnce(new Error('create failed'));

      await expect(service.generatePdf(validCreatePdfDto)).rejects.toThrow(
        'Error generating PDF: create failed',
      );
      expect(notificationsService.sendSlackNotification).toHaveBeenCalledWith(
        ':report:',
        'Reports Microservice - PDF',
        '#FF0000',
        'Error generating PDF',
        expect.stringContaining('create failed'),
        'High',
      );
    });
  });

  describe('subscribeApplication', () => {
    it('should create connection and return formatted success response', async () => {
      const dto: SubscribeApplicationDto = {
        acronym: 'APP',
        environment: 'dev',
      };
      const mockApp = { id: 1, acronym: 'APP' };
      clarisaService.createConnection.mockResolvedValueOnce(mockApp as any);

      const result = await service.subscribeApplication(dto);

      expect(clarisaService.createConnection).toHaveBeenCalledWith({
        acronym: 'APP',
        environment: 'dev',
      });
      expect(result).toEqual({
        description: 'Application subscribed successfully',
        data: mockApp,
        status: HttpStatus.CREATED,
      });
    });

    it('should return formatted error and notify Slack on failure', async () => {
      const dto: SubscribeApplicationDto = {
        acronym: 'APP',
        environment: 'dev',
      };
      clarisaService.createConnection.mockRejectedValueOnce(
        new Error('connection failed'),
      );

      const result = await service.subscribeApplication(dto);

      expect(result).toEqual({
        description: expect.stringContaining('Error subscribing application'),
        data: null,
        status: HttpStatus.BAD_REQUEST,
      });
      expect(notificationsService.sendSlackNotification).toHaveBeenCalledWith(
        ':report:',
        'Reports Microservice - PDF',
        '#FF0000',
        'Error notification details',
        expect.any(String),
        'High',
      );
    });
  });

  describe('buildPdfUrl', () => {
    it('should build URL with base, template name and query params', () => {
      const url = service.buildPdfUrl('https://base.com/', 'template-1', {
        a: 1,
        b: 'two',
      });
      expect(url).toContain('https://base.com');
      expect(url).toContain('template-1');
      expect(url).toContain('a=1');
      expect(url).toContain('b=two');
    });

    it('should omit undefined and null from query', () => {
      const url = service.buildPdfUrl('https://base.com', 't', {
        a: 1,
        b: undefined,
        c: null,
      } as any);
      expect(url).toContain('a=1');
      expect(url).not.toMatch(/b=/);
      expect(url).not.toMatch(/c=/);
    });

    it('should throw if URL exceeds MAX_URL_LENGTH', () => {
      const longName = 'x'.repeat(2100);
      expect(() =>
        service.buildPdfUrl('https://base.com', longName, {}),
      ).toThrow('exceeds maximum length of 2048');
    });
  });

  describe('generatePdfFromUrl', () => {
    const validUrlDto: CreatePdfUrlDto = {
      data: { id: 1 },
      templateName: '001',
      bucketName: 'bucket',
      fileName: 'out.pdf',
    };

    it('should throw if templateName is missing or not string', async () => {
      await expect(
        service.generatePdfFromUrl({
          ...validUrlDto,
          templateName: undefined as any,
        }),
      ).rejects.toThrow('templateName is required');
      await expect(
        service.generatePdfFromUrl({
          ...validUrlDto,
          templateName: 1 as any,
        }),
      ).rejects.toThrow('templateName is required');
    });

    it('should throw if templateName contains /, ?, or #', async () => {
      await expect(
        service.generatePdfFromUrl({
          ...validUrlDto,
          templateName: '00/1',
        }),
      ).rejects.toThrow('must not contain');
    });

    it('should throw if bucketName or fileName is missing', async () => {
      await expect(
        service.generatePdfFromUrl({
          ...validUrlDto,
          bucketName: '',
        }),
      ).rejects.toThrow('bucketName is required');
      await expect(
        service.generatePdfFromUrl({
          ...validUrlDto,
          fileName: '',
        }),
      ).rejects.toThrow('fileName is required');
    });

    it('should throw if data is not a valid object', async () => {
      await expect(
        service.generatePdfFromUrl({
          ...validUrlDto,
          data: [] as unknown as Record<string, string | number | boolean>,
        }),
      ).rejects.toThrow('data must be a valid JSON object');
    });

    it('should throw if PDF_TEMPLATE_BASE_URL is not configured', async () => {
      gotenbergService.getTemplateBaseUrl.mockReturnValueOnce('');

      await expect(service.generatePdfFromUrl(validUrlDto)).rejects.toThrow(
        'PDF_TEMPLATE_BASE_URL is not configured',
      );
    });

    it('should generate PDF from URL, upload to S3 and return file URL', async () => {
      mockS3Send.mockResolvedValueOnce({});

      const result = await service.generatePdfFromUrl(validUrlDto);

      expect(gotenbergService.fetchAstroData).toHaveBeenCalledWith({
        id: 1,
      });
      expect(gotenbergService.convertUrlToPdf).toHaveBeenCalled();
      expect(mockS3Send).toHaveBeenCalled();
      expect(result).toBe('https://bucket.s3.amazonaws.com/out.pdf');
      expect(notificationsService.sendSlackNotification).toHaveBeenCalledWith(
        ':report:',
        'Reports Microservice - PDF',
        '#36a64f',
        'PDF from URL generated successfully',
        expect.any(String),
        'Low',
      );
    });

    it('should notify Slack and rethrow on generatePdfFromUrl error', async () => {
      gotenbergService.convertUrlToPdf.mockRejectedValueOnce(
        new Error('Gotenberg failed'),
      );

      await expect(service.generatePdfFromUrl(validUrlDto)).rejects.toThrow(
        'Gotenberg failed',
      );
      expect(notificationsService.sendSlackNotification).toHaveBeenCalledWith(
        ':report:',
        'Reports Microservice - PDF',
        '#FF0000',
        'Error generating PDF from URL',
        expect.stringContaining('Gotenberg failed'),
        'High',
      );
    });
  });

  describe('checkFileExists', () => {
    it('should return true when HeadObject succeeds', async () => {
      mockS3Send.mockResolvedValueOnce({});

      const result = await service.checkFileExists('bucket', 'key.pdf');

      expect(result).toBe(true);
      expect(mockS3Send).toHaveBeenCalledTimes(1);
      const cmd = mockS3Send.mock.calls[0][0];
      expect(cmd.input.Bucket).toBe('bucket');
      expect(cmd.input.Key).toBe('key.pdf');
    });

    it('should return false when error name is NotFound', async () => {
      const err = new Error('Not found');
      (err as any).name = 'NotFound';
      mockS3Send.mockRejectedValueOnce(err);

      const result = await service.checkFileExists('bucket', 'missing.pdf');

      expect(result).toBe(false);
    });

    it('should rethrow when error is not NotFound', async () => {
      mockS3Send.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        service.checkFileExists('bucket', 'key.pdf'),
      ).rejects.toThrow('Network error');
    });
  });
});
