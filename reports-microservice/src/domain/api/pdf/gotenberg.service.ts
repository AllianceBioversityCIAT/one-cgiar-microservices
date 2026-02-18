import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const MAX_URL_LENGTH = 2048;
const PDF_CONTENT_TYPE = 'application/pdf';

@Injectable()
export class GotenbergService {
  private readonly _logger = new Logger(GotenbergService.name);
  private readonly baseUrl: string;
  private readonly templateBaseUrl: string;
  private readonly paperWidth: string;
  private readonly paperHeight: string;
  private readonly marginTop: string;
  private readonly marginBottom: string;
  private readonly marginLeft: string;
  private readonly marginRight: string;
  private readonly printBackground: string;
  private readonly apiSecret: string;
  private readonly adminSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('GOTENBERG_URL')?.replace(/\/$/, '') ?? '';
    this.templateBaseUrl =
      this.configService
        .get<string>('PDF_TEMPLATE_BASE_URL')
        ?.replace(/\/$/, '') ?? '';
    this.paperWidth =
      this.configService.get<string>('GOTENBERG_PAPER_WIDTH') ?? '600px';
    this.paperHeight =
      this.configService.get<string>('GOTENBERG_PAPER_HEIGHT') ?? '1000px';
    this.marginTop =
      this.configService.get<string>('GOTENBERG_MARGIN_TOP') ?? '0';
    this.marginBottom =
      this.configService.get<string>('GOTENBERG_MARGIN_BOTTOM') ?? '0';
    this.marginLeft =
      this.configService.get<string>('GOTENBERG_MARGIN_LEFT') ?? '0';
    this.marginRight =
      this.configService.get<string>('GOTENBERG_MARGIN_RIGHT') ?? '0';
    this.printBackground =
      this.configService.get<string>('GOTENBERG_PRINT_BACKGROUND') ?? 'true';
    this.apiSecret = this.configService.get<string>('API_SECRET') ?? '';
    this.adminSecret = this.configService.get<string>('ADMIN_SECRET') ?? '';
  }

  async convertUrlToPdf(url: string): Promise<Buffer> {
    const endpoint = this.baseUrl.endsWith('/forms/chromium/convert/url')
      ? this.baseUrl
      : `${this.baseUrl}/forms/chromium/convert/url`;

    const form = new FormData();
    form.append('url', url);
    form.append('paperWidth', this.paperWidth);
    form.append('paperHeight', this.paperHeight);
    form.append('marginTop', this.marginTop);
    form.append('marginBottom', this.marginBottom);
    form.append('marginLeft', this.marginLeft);
    form.append('marginRight', this.marginRight);
    form.append('printBackground', this.printBackground);

    this._logger.debug(`Sending URL to Gotenberg: ${url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(endpoint, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      this._logger.error(
        `Gotenberg returned ${response.status}: ${errorBody}`,
      );
      throw new Error(
        `Gotenberg conversion failed: ${response.status} ${errorBody}`,
      );
    }

    const contentType =
      response.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
    if (contentType !== PDF_CONTENT_TYPE) {
      this._logger.error(
        `Gotenberg response Content-Type is ${contentType}, expected ${PDF_CONTENT_TYPE}`,
      );
      throw new Error(
        `Gotenberg returned non-PDF content: Content-Type ${contentType}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (!buffer || buffer.length === 0) {
      this._logger.error('Gotenberg returned empty response');
      throw new Error('Gotenberg returned empty PDF');
    }

    return buffer;
  }

  getTemplateBaseUrl(): string {
    return this.templateBaseUrl;
  }

  /**
   * Calls the Astro server /api/data endpoint with user data.
   * Returns the response object which becomes the query params for the Gotenberg URL.
   */
  async fetchAstroData(
    data: Record<string, string | number | boolean>,
  ): Promise<Record<string, string | number | boolean>> {
    const astroEndpoint = `${this.templateBaseUrl}/api/data`;
    this._logger.debug(`Fetching Astro data from: ${astroEndpoint}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(astroEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-secret': this.apiSecret},
      body: JSON.stringify(data),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      this._logger.error(
        `Astro API returned ${response.status}: ${errorBody}`,
      );
      throw new Error(
        `Astro API failed: ${response.status} ${errorBody}`,
      );
    }

    const json = await response.json();
    if (typeof json !== 'object' || json === null || Array.isArray(json)) {
      throw new Error('Astro API must return a JSON object');
    }
    return json as Record<string, string | number | boolean>;
  }

  static getMaxUrlLength(): number {
    return MAX_URL_LENGTH;
  }
}
