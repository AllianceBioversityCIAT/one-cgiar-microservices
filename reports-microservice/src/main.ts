import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const logger: Logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  const configService = app.get(ConfigService);

  const config = new DocumentBuilder()
    .setTitle('Reports Microservice API')
    .setDescription('Reports Microservice API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const port: number = +configService.get<number>('PORT') || 3003;
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const queueName: string = `${configService.get<string>('QUEUE_NAME')}reports_queue`;

  const microservice =
    await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
      transport: Transport.RMQ,
      options: {
        urls: [configService.get<string>('RABBITMQ_URL')],
        queue: queueName,
        queueOptions: {
          durable: true,
        },
      },
    });

  await app
    .listen(port)
    .then(() => {
      logger.debug(`Application is running http://localhost:${port}`);
      logger.debug(`Documentation is running http://localhost:${port}/api`);
    })
    .catch((err) => {
      const portValue: number | string = port || '<Not defined>';
      logger.error(`Application failed to start on port ${portValue}`);
      logger.error(err);
    });

  await microservice
    .listen()
    .then(() => {
      logger.debug(`Microservice is already listening`);
    })
    .catch((err) => {
      logger.error(`Microservice present an error`);
      logger.error(err);
    });
}
bootstrap();
