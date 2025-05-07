import SMTPTransport from 'nodemailer/lib/smtp-transport';
import { env } from 'process';
import { ENV } from '../../shared/utils/env.utils';
import { createTransport } from 'nodemailer';

export const mailerConnection = () => {
  let options: SMTPTransport.Options = {
    host: env.MS_SERVER_SMTP,
    port: parseInt(env.MS_SERVER_SMTP_PORT),
    logger: !ENV.IS_PRODUCTION,
    debug: !ENV.IS_PRODUCTION,
    secure: false,
    ignoreTLS: true,
    tls: {
      rejectUnauthorized: false,
    },
  };

  if (ENV.IS_PRODUCTION) {
    options = {
      ...options,
      auth: {
        user: env.MS_SERVER_SMTP_USERNAME,
        pass: env.MS_SERVER_SMTP_PASSWORD,
      },
    };
  }

  return createTransport(options);
};
