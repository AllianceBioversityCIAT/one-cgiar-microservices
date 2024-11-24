import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const _logger: Logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { cors: true });
  app.useGlobalPipes(new ValidationPipe());
  const port = process.env.PORT ?? 3000;

  const swaggerConfig = new DocumentBuilder()
    .setTitle('AI MICROSERVICE')
    .setDescription('API Documentation for AI Microservice')
    .setVersion('2.0')
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('swagger', app, swaggerDocument);

  await app
    .listen(port)
    .then(() => {
      _logger.debug(`Server is running on http://localhost:${port}`);
      _logger.debug(`Swagger is running on http://localhost:${port}/swagger`);
    })
    .catch((error) => {
      const portValue: number | string = port || '<Not defined>';
      _logger.error(`Application failed to start on port ${portValue}`);
      _logger.error(`Error starting server ${error}`);
    });
}
bootstrap();
