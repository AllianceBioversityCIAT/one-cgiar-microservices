/**
 * The sign-in code e-mail (`OTP-R-32`).
 *
 * The branding block is copied from PRMS
 * `onecgiar-pr-server/src/auth/modules/user/user.service.ts:743-750` so the
 * code e-mail looks like every other PRMS notification.
 *
 * The bundled template is handlebars-*style* on purpose: the notification
 * pipeline only ever receives a rendered HTML string, so a ~10 line `{{var}}`
 * replacer replaces the handlebars runtime dependency (`amqplib` stays the
 * only runtime dep of this package).
 */

/** Lifetime advertised in the e-mail; matches `general-client` `AuthSessionValidity` (design.md §18.1). */
export const CODE_EXPIRY_MINUTES = 5;

/** Subject line required by `OTP-R-32` / the `OTP-T-11` work order. */
export const OTP_EMAIL_SUBJECT = 'Your PRMS Reporting Tool sign-in code';

/** Display name of the sender, as used by every PRMS notification. */
export const OTP_EMAIL_SENDER_NAME = 'PRMS Reporting Tool';

/** Branding block — PRMS `user.service.ts:743-750`. */
export const PRMS_BRANDING = {
  logoUrl:
    'https://prms-file-storage.s3.amazonaws.com/email-images/Email_PRMS_Header.png',
  appName: 'PRMS Reporting Tool',
  supportEmail: 'PRMSTechSupport@cgiar.org',
  senderName: 'PRMS Team',
} as const;

/** `APP_URL` default — PRMS `user.service.ts:744` (`appUrl`). */
const DEFAULT_APP_URL = 'https://reporting.cgiar.org/';

/**
 * Minimal `ConfigMessageDto` (notification-microservice `mailer.dto.ts`).
 *
 * `to` / `cc` / `bcc` are **comma-separated strings, not arrays**: the deployed
 * consumer types them `string` and runs `String.split(',')` over `to` and `cc`
 * (`mailer.service.ts#validMultiplesEmails`), which an array would break. This
 * mirrors the emitter already proven against that consumer —
 * `auth-microservice/.../bulk-registration.service.ts:173`.
 */
export interface OtpEmailMessage {
  from: { email: string; name: string };
  emailBody: {
    subject: string;
    to: string;
    cc: string;
    bcc: string;
    message: { text: string; socketFile: string };
  };
}

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/**
 * Replaces `{{name}}` with `data.name`. Unknown placeholders are left in place
 * rather than silently blanked, so a typo shows up in the rendered output (and
 * in the "leaves no placeholder unresolved" test) instead of shipping a hole.
 */
export function renderTemplate(
  template: string,
  data: Record<string, string | number>,
): string {
  return template.replace(PLACEHOLDER, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(data, key) ? String(data[key]) : match,
  );
}

const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{{appName}}</title>
    <style>
      body { margin: 0; padding: 0; background-color: #f4f6f8; }
      .wrapper { width: 100%; background-color: #f4f6f8; padding: 24px 0; }
      .card { width: 100%; max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; font-family: Arial, Helvetica, sans-serif; color: #1f2a37; }
      .header { padding: 0; text-align: center; }
      .header img { display: block; width: 100%; max-width: 560px; height: auto; border: 0; }
      .content { padding: 28px 32px 8px 32px; font-size: 15px; line-height: 22px; }
      .otp-code { font-family: "Courier New", Consolas, Menlo, monospace; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1f2a37; text-align: center; padding: 18px 0; margin: 20px 0; background-color: #f0f4f8; border-radius: 6px; }
      .muted { color: #5b6b7c; font-size: 13px; line-height: 20px; }
      .footer { padding: 8px 32px 28px 32px; }
      .footer a { color: #1689b8; }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="card">
        <div class="header">
          <img src="{{logoUrl}}" alt="{{appName}}" />
        </div>
        <div class="content">
          <p>Hello,</p>
          <p>Use the code below to sign in to the <strong>{{appName}}</strong>.</p>
          <div class="otp-code">{{code}}</div>
          <p class="muted">The code expires in {{expiryMinutes}} minutes and can only be used once.</p>
          <p class="muted">If you did not request this code, you can safely ignore this email — nobody can sign in without it.</p>
        </div>
        <div class="footer">
          <p class="muted">
            Need help? Contact <a href="mailto:{{supportEmail}}">{{supportEmail}}</a>.
          </p>
          <p class="muted">
            <a href="{{appUrl}}">{{appUrl}}</a><br />
            {{senderName}}
          </p>
        </div>
      </div>
    </div>
  </body>
</html>`;

const TEXT_TEMPLATE = `Hello,

Use this code to sign in to the {{appName}}: {{code}}

The code expires in {{expiryMinutes}} minutes and can only be used once.
If you did not request this code, you can safely ignore this email.

Need help? Contact {{supportEmail}}
{{appUrl}}
{{senderName}}`;

function templateData(code: string): Record<string, string | number> {
  return {
    ...PRMS_BRANDING,
    appUrl: process.env.APP_URL || DEFAULT_APP_URL,
    code,
    expiryMinutes: CODE_EXPIRY_MINUTES,
  };
}

/** Renders the branded HTML body carrying `code`. */
export function renderOtpEmailHtml(code: string): string {
  return renderTemplate(HTML_TEMPLATE, templateData(code));
}

/** Renders the plain-text alternative carrying `code`. */
export function renderOtpEmailText(code: string): string {
  return renderTemplate(TEXT_TEMPLATE, templateData(code));
}

/**
 * Builds the `ConfigMessageDto` the notification microservice consumes.
 * `message.socketFile` is the HTML string — the consumer turns a string into a
 * Buffer itself (`mailer.controller.ts` `@MessagePattern('send')`).
 */
export function buildOtpEmailMessage(
  email: string,
  code: string,
): OtpEmailMessage {
  return {
    from: {
      email: process.env.EMAIL_SENDER ?? '',
      name: OTP_EMAIL_SENDER_NAME,
    },
    emailBody: {
      subject: OTP_EMAIL_SUBJECT,
      to: email,
      cc: '',
      bcc: '',
      message: {
        text: renderOtpEmailText(code),
        socketFile: renderOtpEmailHtml(code),
      },
    },
  };
}
