import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import * as bodyparser from 'body-parser';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger: Logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.use(bodyparser.urlencoded({ limit: '100mb', extended: true }));
  app.use(bodyparser.json({ limit: '100mb' }));
  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('CGIAR Authentication API')
    .setDescription('Authentication and authorization microservice for CGIAR applications')
    .setVersion('1.0')
    .addTag('auth', 'Authentication endpoints')
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    explorer: true,
    swaggerOptions: {
      filter: true,
      showRequestDuration: true,
    },
  });

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

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  await app
    .listen(port)
    .then(() => {
      logger.log(`Application is running http://localhost:${port}`);
      logger.log(`Swagger documentation available at http://localhost:${port}/api/docs`);
    })
    .catch((err) => {
      const portValue: number | string = port || '<Not defined>';
      logger.error(`Application failed to start on port ${portValue}`);
      logger.error(err);
    });
}
bootstrap();
