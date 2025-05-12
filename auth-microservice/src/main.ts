import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import * as bodyparser from 'body-parser';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const logger: Logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Apply global validation pipe
  app.useGlobalPipes(new ValidationPipe());

  // Apply global logging interceptor
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Body parser configuration
  app.use(bodyparser.urlencoded({ limit: '100mb', extended: true }));
  app.use(bodyparser.json({ limit: '100mb' }));

  // Enable CORS
  app.enableCors();

  // Security with Helmet
  app.use(
    helmet({
      xssFilter: true,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://fonts.googleapis.com',
          ],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
        },
      },
    }),
  );

  // Configuration and port setup
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  // Start the server
  await app
    .listen(port)
    .then(() => {
      logger.log(`Application is running http://localhost:${port}`);
    })
    .catch((err) => {
      const portValue: number | string = port || '<Not defined>';
      logger.error(`Application failed to start on port ${portValue}`);
      logger.error(err);
    });
}
bootstrap();
