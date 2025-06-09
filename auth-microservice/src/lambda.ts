import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Context, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import serverlessExpress from '@vendia/serverless-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { LoggingInterceptor } from './shared/interceptors/logging.interceptor';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';
import * as bodyparser from 'body-parser';
import helmet from 'helmet';
import express from 'express';

let cachedServer: any;

const createApp = async () => {
  if (!cachedServer) {
    const logger: Logger = new Logger('Lambda');
    const expressApp = express();
    
    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressApp),
      {
        logger: ['error', 'warn', 'log'],
      }
    );

    // Global configurations
    app.useGlobalPipes(new ValidationPipe());
    app.useGlobalInterceptors(new LoggingInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    
    app.use(bodyparser.urlencoded({ limit: '100mb', extended: true }));
    app.use(bodyparser.json({ limit: '100mb' }));
    app.enableCors();

    // Swagger configuration
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

    // Security middleware
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

    await app.init();
    
    cachedServer = serverlessExpress({ app: expressApp });
    logger.log('Lambda function initialized successfully');
  }
  
  return cachedServer;
};

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  const server = await createApp();
  return server(event, context);
};
