import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { HttpErrorFilter } from './filter/error.filter';
import { LoggerMiddleware } from './middleware/logger.middleware';
import { env } from 'process';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger: Logger = new Logger('Main');

  app.enableCors();
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));
  app.useGlobalFilters(new HttpErrorFilter());
  const port = env.PORT || 3000;

  const config = new DocumentBuilder()
    .setTitle('API for Text Mining')
    .setDescription('API for Text Mining')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('aws', app, document);

  await app.listen(port);
  logger.verbose(`The server is running on port ${port}`);
}
bootstrap();
