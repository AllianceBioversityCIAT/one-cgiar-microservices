import {
  CODE_EXPIRY_MINUTES,
  OTP_EMAIL_SUBJECT,
  PRMS_BRANDING,
  buildOtpEmailMessage,
  renderOtpEmailHtml,
  renderOtpEmailText,
  renderTemplate,
} from './email-template';

describe('email-template', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env.EMAIL_SENDER = 'PRMS-No-reply@cgiar.org';
    process.env.APP_URL = 'https://reporting.cgiar.org/';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  describe('renderTemplate (tiny {{var}} replacer — handlebars is not a runtime dep)', () => {
    it('replaces every occurrence of a placeholder', () => {
      expect(renderTemplate('{{a}}-{{b}}-{{a}}', { a: '1', b: '2' })).toBe(
        '1-2-1',
      );
    });

    it('tolerates whitespace inside the braces', () => {
      expect(renderTemplate('{{ a }}', { a: 'x' })).toBe('x');
    });

    it('leaves unknown placeholders untouched rather than inventing a value', () => {
      expect(renderTemplate('{{a}}/{{unknown}}', { a: 'x' })).toBe(
        'x/{{unknown}}',
      );
    });
  });

  describe('branding block (PRMS user.service.ts:743-750)', () => {
    it('carries the exact PRMS values', () => {
      expect(PRMS_BRANDING).toEqual({
        logoUrl:
          'https://prms-file-storage.s3.amazonaws.com/email-images/Email_PRMS_Header.png',
        appName: 'PRMS Reporting Tool',
        supportEmail: 'PRMSTechSupport@cgiar.org',
        senderName: 'PRMS Team',
      });
    });
  });

  describe('renderOtpEmailHtml (OTP-R-32)', () => {
    const html = () => renderOtpEmailHtml('482913');

    it('shows the code', () => {
      expect(html()).toContain('482913');
    });

    it('renders the code in large monospace digits', () => {
      const digits = /<[^>]*class="otp-code"[^>]*>\s*482913\s*</.exec(html());
      expect(digits).not.toBeNull();
      expect(html()).toMatch(/\.otp-code\s*\{[^}]*monospace/);
      expect(html()).toMatch(/\.otp-code\s*\{[^}]*font-size:\s*3[0-9]px/);
    });

    it('states the 5 minute lifetime', () => {
      expect(CODE_EXPIRY_MINUTES).toBe(5);
      expect(html()).toContain('expires in 5 minutes');
    });

    it('tells the reader to ignore the message if they did not request it', () => {
      expect(html()).toContain('did not request');
    });

    it('carries the PRMS branding block and the support line', () => {
      expect(html()).toContain(PRMS_BRANDING.logoUrl);
      expect(html()).toContain(PRMS_BRANDING.appName);
      expect(html()).toContain(PRMS_BRANDING.supportEmail);
      expect(html()).toContain(PRMS_BRANDING.senderName);
    });

    it('links back to the app URL from the environment', () => {
      process.env.APP_URL = 'https://reporting-test.cgiar.org/';

      expect(renderOtpEmailHtml('482913')).toContain(
        'https://reporting-test.cgiar.org/',
      );
    });

    it('falls back to the production app URL when APP_URL is unset', () => {
      delete process.env.APP_URL;

      expect(renderOtpEmailHtml('482913')).toContain(
        'https://reporting.cgiar.org/',
      );
    });

    it('leaves no placeholder unresolved', () => {
      expect(html()).not.toContain('{{');
    });

    it('constrains the header logo to 220px with an explicit width attribute (OTP-T-14 — Gmail ignores CSS-only sizing)', () => {
      const img = /<img\b[^>]*>/.exec(html());
      expect(img).not.toBeNull();
      const tag = img![0];

      expect(tag).toContain('width="220"');
      expect(tag).toMatch(/style="[^"]*width:\s*220px/);
      expect(tag).toContain('max-width:100%');
      expect(tag).toContain(`alt="${PRMS_BRANDING.appName}"`);
    });
  });

  describe('renderOtpEmailText (plain-text alternative)', () => {
    it('carries the code, the lifetime and the support address', () => {
      const text = renderOtpEmailText('482913');

      expect(text).toContain('482913');
      expect(text).toContain('expires in 5 minutes');
      expect(text).toContain(PRMS_BRANDING.supportEmail);
      expect(text).not.toContain('<');
    });
  });

  describe('buildOtpEmailMessage (ConfigMessageDto for the notification queue)', () => {
    it('builds the PRMS sender, subject and recipient', () => {
      const message = buildOtpEmailMessage('someone@cgiar.org', '482913');

      expect(message.from).toEqual({
        email: 'PRMS-No-reply@cgiar.org',
        name: 'PRMS Reporting Tool',
      });
      expect(message.emailBody.subject).toBe(
        'Your PRMS Reporting Tool sign-in code',
      );
      expect(OTP_EMAIL_SUBJECT).toBe('Your PRMS Reporting Tool sign-in code');
      expect(message.emailBody.to).toBe('someone@cgiar.org');
      expect(message.emailBody.cc).toBe('');
      expect(message.emailBody.bcc).toBe('');
    });

    it('addresses the recipient as a string, the shape the deployed consumer splits', () => {
      const { emailBody } = buildOtpEmailMessage('someone@cgiar.org', '482913');

      // `mailer.service.ts#validMultiplesEmails` runs String.split(',') over
      // `to` and `cc`; an array would throw there.
      expect(typeof emailBody.to).toBe('string');
      expect(typeof emailBody.cc).toBe('string');
      expect(Array.isArray(emailBody.to)).toBe(false);
    });

    it('puts the HTML body in socketFile and the plain text in text', () => {
      const message = buildOtpEmailMessage('someone@cgiar.org', '482913');

      expect(message.emailBody.message.socketFile).toBe(
        renderOtpEmailHtml('482913'),
      );
      expect(message.emailBody.message.text).toBe(renderOtpEmailText('482913'));
    });
  });
});
