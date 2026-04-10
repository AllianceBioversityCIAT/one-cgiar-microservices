import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import * as bodyparser from 'body-parser';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { LoggingInterceptor } from './shared/interceptors/logging.interceptor';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';

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
    .setDescription(
      `
      Authentication and authorization microservice for CGIAR applications.
      
      ## Authentication with CLARISA
      
      This API requires authentication using CLARISA credentials. To authenticate your requests, include the following header:
      
      \`\`\`
      {
        "auth": "{"username":"your_client_id","password":"your_client_secret"}"
      }
      \`\`\`
      
      These credentials must be obtained from CLARISA and are specific to your Management Information System (MIS).
      
      ## Getting CLARISA Credentials
      
      If you don't have CLARISA credentials, contact the CGIAR administration to request a connection between your MIS and this Authentication Microservice.
      
      ## Error Codes
      
      - **400 Bad Request**: Missing or malformed authentication header
      - **401 Unauthorized**: Invalid credentials
      - **500 Internal Server Error**: Server-side error
    `,
    )
    .setVersion('1.0')
    .addTag('auth', 'Authentication endpoints')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'auth',
        in: 'header',
        description:
          'CLARISA authentication credentials in JSON format: {"username":"client_id","password":"client_secret"}',
      },
      'clarisa-auth',
    )
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
      logger.log(
        `Swagger documentation available at http://localhost:${port}/api/docs`,
      );
    })
    .catch((err) => {
      const portValue: number | string = port || '<Not defined>';
      logger.error(`Application failed to start on port ${portValue}`);
      logger.error(err);
    });
}
bootstrap();
