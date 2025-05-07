# Reports Microservice

## Description

This microservice is responsible for generating and managing PDF reports using RabbitMQ for messaging and queues. The service also integrates with S3 for storing the generated PDFs.

## Key Features

- Generate PDF reports from HTML templates
- Store generated PDFs in AWS S3
- Send Slack notifications for successful and failed PDF generation
- Log all PDF generation requests and responses
- Monitor and manage PDF generation requests using RabbitMQ

## Prerequisites

- Node.js (recommended version: 14.x or higher)
- npm (usually comes with Node.js)
- RabbitMQ server
- AWS account and configured credentials
- Slack webhook (for notifications)
- CLARISA service access (for authentication)

## Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd reports-microservice
   ```

2. Install the dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables. Create a `.env` file in the root of the project with the following content:

   ```env
   PORT=3000
   RABBITMQ_URL=''
   CLARISA_HOST=''
   CLARISA_MIS=''
   CLARISA_MIS_ENV=''
   CLARISA_LOGIN=''
   CLARISA_PASSWORD=''
   IS_PRODUCTION=boolean
   SEE_ALL_LOGS=boolean
   QUEUE_NAME=''
   SLACK_WEBHOOK_URL=''
   AWS_REGION=''
   AWS_ACCESS_KEY_ID=''
   AWS_SECRET_ACCESS_KEY=''
   ```

## Running the Application

To start the server in development mode:

```
npm run start:dev
```

For production build and run:

```
npm run build
npm run start:prod
```

The server will start at `http://localhost:3000` (or the port you've configured).

## Authentication

This microservice uses a custom JWT middleware for authentication. Here's an overview of the authentication process:

1. The client must include an `auth` header in their request. The header should be a JSON string containing `username` and `password`.

2. The middleware parses the `auth` header and uses the CLARISA service to validate the credentials.

3. If the credentials are valid, the middleware checks if the user is authorized to access the microservice based on the CLARISA_MIS environment variable.

4. If authorized, the request proceeds to the appropriate route handler.

Example of the `auth` header:

```
{
  "username": "your_username",
  "password": "your_password"
}
```

Note: Ensure that your client encodes this JSON string properly when sending it as a header.

If authentication fails, the middleware will return an appropriate error response and send a notification to Slack.

## Project Structure

```
└── 📁reports-microservice
    └── 📁src
        └── app.module.ts
        └── 📁domain
            └── 📁api
                └── 📁pdf
                    └── 📁dto
                        └── create-pdf.dto.ts
                        └── subscribe-application.dto.ts
                    └── handlebars-helper.ts
                    └── pdf.controller.ts
                    └── pdf.module.ts
                    └── pdf.service.ts
            └── 📁notifications
                └── notifications.module.ts
                └── notifications.service.ts
            └── 📁routes
                └── authorization.routes.ts
                └── main.routes.ts
            └── 📁shared
                └── 📁enum
                └── 📁errors
                    └── global.exception.ts
                └── 📁global-dto
                    └── auth.dto.ts
                    └── response-clarisa.dto.ts
                    └── server-response.dto.ts
                    └── service-response.dto.ts
                └── 📁guards
                    └── auth.guard.ts
                └── 📁interceptors
                    └── logging.interceptor.ts
                    └── microservice.intercetor.ts
                    └── response.interceptor.ts
                └── 📁middlewares
                    └── jwt.middleware.spec.ts
                    └── jwt.middleware.ts
            └── 📁tools
                └── 📁clarisa
                    └── clarisa.connection.ts
                    └── clarisa.module.ts
                    └── clarisa.service.ts
                    └── 📁dto
                        └── clarisa-create-conection.dto.ts
            └── 📁utils
                └── env.utils.ts
                └── response.utils.ts
        └── main.ts
        └── serverless.ts
    └── 📁test
```

## Data Transfer Objects (DTOs)

The microservice uses the following DTOs for file management operations:

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class CreatePdfDto {
  @ApiProperty({ description: 'The data to be used in the template' })
  public data: any;

  @ApiProperty({
    description: 'The template data, with handlebars syntax',
  })
  public templateData: string;

  @ApiProperty({ description: 'The options to be used in the pdf generation' })
  public options: any;

  @ApiProperty({ description: 'The bucket name to store the file' })
  public bucketName: string;

  @ApiProperty({ description: 'The file name to store the file' })
  public fileName: string;
}
```

These DTOs are used to ensure type safety and provide clear API documentation through Swagger.


## RabbitMQ Integration

### Subscriptions

The microservice uses RabbitMQ for processing PDF generation requests. Ensure RabbitMQ is running and accessible.

## Client Configuration

First, install the necesary package:

```bash
npm install @nestjs/microservices
npm install amqplib
npm install amqp-connection-manager
```

To configure a client to send messages to this microservice, you can use the following configuration in a NestJS module:

### Example Queue Configuration

Ensure your RabbitMQ configuration matches the following:

- name: `REPORT_SERVICE`
- transport: `Trasport.RMQ`
- urls: `Provide your RabbitMQ URL`
- queue: `Provide your queue name`
- queueOptions: `{ durable: true }`

### Module Configuration

```typescript
    ClientsModule.register([
      {
        name: 'REPORT_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [env.RABBITMQ_URL],
          queue: env.REPORT_QUEUE,
          queueOptions: {
            durable: true,
          },
        },
      },
    ]),
```

### Service Configuration

The service must implement the `OnModuleInit` interface:

```typescript
export class Service implements OnModuleInit {}
```

You must initialise the client in the method `onModuleInit`:

```typescript
  constructor(
    @Inject('REPORT_SERVICE') private readonly client: ClientProxy,
  ) {}

  // Use the client to send messages
  async onModuleInit(): Promise<void> {
    await this.client.connect();
  }
```

The client is now ready to send messages to the microservice. The client can send messages using the `emit` method:

```typescript
  async sendReport(data: any): Promise<void> {
    const info = {
      templateData: report.template_object.template,
      data: data,
      options: Number(report.id) === 1 ? optionsReporting : optionsIPSR,
      fileName,
      bucketName,
      credentials: this.authHeader,
    };
    this.client.emit({ cmd: 'generate' }, info);
  }
```
