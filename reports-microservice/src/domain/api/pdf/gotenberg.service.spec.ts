import { ConfigService } from '@nestjs/config';
import { GotenbergService } from './gotenberg.service';

const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

describe('GotenbergService', () => {
  let service: GotenbergService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    jest.clearAllMocks();
    configService = {
      get: jest.fn((key: string) => {
        const map: Record<string, string> = {
          GOTENBERG_URL: 'https://gotenberg.example.com/',
          PDF_TEMPLATE_BASE_URL: 'https://templates.example.com/',
          GOTENBERG_PAPER_WIDTH: '600px',
          GOTENBERG_PAPER_HEIGHT: '1000px',
          GOTENBERG_MARGIN_TOP: '0',
          GOTENBERG_MARGIN_BOTTOM: '0',
          GOTENBERG_MARGIN_LEFT: '0',
          GOTENBERG_MARGIN_RIGHT: '0',
          GOTENBERG_PRINT_BACKGROUND: 'true',
          API_SECRET: 'secret',
          ADMIN_SECRET: 'admin',
        };
        return map[key] ?? '';
      }),
    } as unknown as jest.Mocked<ConfigService>;
    service = new GotenbergService(configService);
  });

  describe('getTemplateBaseUrl', () => {
    it('should return template base URL without trailing slash', () => {
      expect(service.getTemplateBaseUrl()).toBe(
        'https://templates.example.com',
      );
    });
  });

  describe('getMaxUrlLength', () => {
    it('should return 2048', () => {
      expect(GotenbergService.getMaxUrlLength()).toBe(2048);
    });
  });

  describe('convertUrlToPdf', () => {
    it('should build endpoint and return PDF buffer on success', async () => {
      const pdfBytes = new Uint8Array([1, 2, 3, 4, 5]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/pdf' }),
        arrayBuffer: () =>
          Promise.resolve(pdfBytes.buffer.slice(0, pdfBytes.length)),
      });

      const result = await service.convertUrlToPdf('https://example.com/page');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://gotenberg.example.com/forms/chromium/convert/url',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        }),
      );
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBe(5);
    });

    it('should throw when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal error'),
      });

      await expect(
        service.convertUrlToPdf('https://example.com'),
      ).rejects.toThrow('Gotenberg conversion failed');
    });

    it('should throw when content-type is not application/pdf', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'text/html' }),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
      });

      await expect(
        service.convertUrlToPdf('https://example.com'),
      ).rejects.toThrow('non-PDF content');
    });

    it('should throw when response body is empty', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/pdf' }),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      });

      await expect(
        service.convertUrlToPdf('https://example.com'),
      ).rejects.toThrow('empty PDF');
    });

    it('should use paper overrides when provided, else env defaults', async () => {
      const pdfBytes = new Uint8Array([1, 2, 3]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/pdf' }),
        arrayBuffer: () =>
          Promise.resolve(pdfBytes.buffer.slice(0, pdfBytes.length)),
      });

      await service.convertUrlToPdf('https://example.com', {
        paperWidth: '700px',
        paperHeight: '1100px',
      });

      const form = (mockFetch.mock.calls[0][1] as { body: FormData })
        .body as FormData;
      const entries = Array.from((form as any).entries());
      expect(
        entries.find((e: [string, string]) => e[0] === 'paperWidth'),
      ).toEqual(['paperWidth', '700px']);
      expect(
        entries.find((e: [string, string]) => e[0] === 'paperHeight'),
      ).toEqual(['paperHeight', '1100px']);
    });
  });

  describe('fetchAstroData', () => {
    it('should POST to /api/data and return JSON object', async () => {
      const data = { id: 1, name: 'test' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(data),
      });

      const result = await service.fetchAstroData({ id: 1, name: 'test' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://templates.example.com/api/data',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-api-secret': 'secret',
          }),
          body: JSON.stringify({ id: 1, name: 'test' }),
        }),
      );
      expect(result).toEqual(data);
    });

    it('should throw when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad request'),
      });

      await expect(service.fetchAstroData({})).rejects.toThrow(
        'Astro API failed',
      );
    });

    it('should throw when response is not a JSON object', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await expect(service.fetchAstroData({})).rejects.toThrow(
        'Astro API must return a JSON object',
      );
    });
  });
});
