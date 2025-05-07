import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';
import { env } from 'process';
import { json, urlencoded } from 'express';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

export async function bootstrap() {
  const logger: Logger = new Logger('Bootstrap');

  if (env.MS_HTTP_SERVER_AVALIABLE === 'true') {
    const app = await NestFactory.create(AppModule);
    app.enableCors();
    app.use(json({ limit: '50mb' }));
    app.use(urlencoded({ extended: true, limit: '50mb' }));

    const config = new DocumentBuilder()
      .setTitle('Notification Microservice API')
      .setDescription('Notification Microservice API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const swaggerPath: string = 'swagger';
    const port: number = parseInt(env.MS_PORT);
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(swaggerPath, app, document);

    await app
      .listen(port)
      .then(() => {
        logger.debug(`Application is running http://localhost:${port}`);
        logger.debug(
          `Documentation is running http://localhost:${port}/${swaggerPath}`,
        );
      })
      .catch((err) => {
        const portValue: number | string = port || '<Not defined>';
        logger.error(`Application failed to start on port ${portValue}`);
        logger.error(err);
      });
  }
  const queueHost: string = `amqps://${env.MS_RMQ_USER}:${env.MS_RMQ_PASSWORD}@${env.MS_RMQ_HOST}`;
  const microservice =
    await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
      transport: Transport.RMQ,
      options: {
        urls: [queueHost],
        queue: env.MS_QUEUE_PATH,
        queueOptions: {
          durable: true,
        },
      },
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
