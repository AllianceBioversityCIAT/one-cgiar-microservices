# File Management Microservice

## Description

This microservice provides file management functionalities, including uploading, validating, and deleting files in Amazon S3.

## Key Features

- File upload to Amazon S3
- Validation of existing files in S3
- File deletion from S3
- Slack notifications integration
- API documentation with Swagger
- Custom JWT authentication middleware

## Prerequisites

- Node.js (recommended version: 14.x or higher)
- npm (usually comes with Node.js)
- AWS account and configured credentials
- Slack webhook (for notifications)
- CLARISA service access (for authentication)

## Installation

1. Clone the repository:

   ```
   git clone [REPOSITORY_URL]
   cd file-management-microservice
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Copy the `.env.example` file to `.env` and configure the environment variables:

   ```
   cp .env.example .env
   ```

   Make sure to properly configure the following variables:

   ```
   PORT=3000
   CLARISA_HOST=''
   CLARISA_MIS=''
   CLARISA_MIS_ENV=''
   CLARISA_LOGIN=''
   CLARISA_PASSWORD=''
   IS_PRODUCTION=boolean
   SEE_ALL_LOGS=boolean
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

## API Documentation

API documentation is available through Swagger UI. Once the server is running, you can access it at:

```
http://localhost:3000/swagger
```

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
└── 📁file-management-microservice
    └── 📁src
        └── app.module.ts
        └── main.ts
        └── 📁domain
            └── 📁api
                └── 📁file-management
                    └── file-management.controller.ts
                    └── file-management.service.ts
                    └── 📁dto
                        └── upload-file-management.dto.ts
            └── 📁notifications
                └── notifications.module.ts
                └── notifications.service.ts
            └── 📁routes
                └── main.routes.ts
            └── 📁utils
                └── response.utils.ts
            └── 📁shared
                └── 📁middlewares
                    └── jwt.middleware.ts
    └── 📁test
    └── .env
    └── package.json
    └── tsconfig.json
    └── ... (other configuration files)
```

## Main Endpoints

- `POST /api/file-management/upload`: Upload a file to S3
- `POST /api/file-management/validation`: Validate and retrieve a file from S3
- `DELETE /api/file-management/delete`: Delete a file from S3

For more details, refer to the Swagger documentation.

## Data Transfer Objects (DTOs)

The microservice uses the following DTOs for file management operations:

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class UploadFileDto {
  @ApiProperty({ description: 'Name of the file' })
  fileName: string;

  @ApiProperty({ description: 'Name of the S3 bucket' })
  bucketName: string;

  @ApiProperty({ description: 'File to upload' })
  file: any;
}

export class FileValidationDto {
  @ApiProperty({ description: 'Name of the S3 bucket' })
  bucketName: string;

  @ApiProperty({ description: 'Key of the file in the S3 bucket' })
  key: string;
}
```

These DTOs are used to ensure type safety and provide clear API documentation through Swagger.

### Client Configuration Example (using Axios)

Here's an example of how to configure a client using Axios:

```javascript
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000/api/file-management'; // Adjust as needed

// Create an Axios instance with default configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add an interceptor to include the auth header with every request
apiClient.interceptors.request.use((config) => {
  const authHeader = {
    username: 'your_username',
    password: 'your_password',
  };
  config.headers['auth'] = JSON.stringify(authHeader);
  return config;
});

// Example function to upload a file
async function uploadFile(fileName, bucketName, fileContent) {
  try {
    const response = await apiClient.post('/upload', {
      fileName,
      bucketName,
      file: fileContent,
    });
    return response.data;
  } catch (error) {
    console.error('Error uploading file:', error.response.data);
    throw error;
  }
}

// Example function to validate a file
async function validateFile(bucketName, key) {
  try {
    const response = await apiClient.post(
      '/validation',
      {
        bucketName,
        key,
      },
      {
        responseType: 'json',
      },
    );
    return response.data;
  } catch (error) {
    console.error('Error validating file:', error.response.data);
    throw error;
  }
}

// Example function to delete a file
async function deleteFile(bucketName, key) {
  try {
    const response = await apiClient.delete('/delete', {
      data: { bucketName, key },
    });
    return response.data;
  } catch (error) {
    console.error('Error deleting file:', error.response.data);
    throw error;
  }
}

// Usage examples
(async () => {
  try {
    await uploadFile('example.txt', 'my-bucket', 'file content');
    await validateFile('my-bucket', 'example.txt');
    await deleteFile('my-bucket', 'example.txt');
  } catch (error) {
    console.error('Operation failed:', error);
  }
})();
```

This example demonstrates how to set up a client using Axios, including the authentication header with each request, and provides sample functions for interacting with the microservice's main endpoints.

## Available Scripts

- `npm run build`: Compile the project
- `npm run format`: Format the code using Prettier
- `npm run start`: Start the server
- `npm run start:dev`: Start the server in development mode with auto-reload
- `npm run start:debug`: Start the server in debug mode
- `npm run start:prod`: Start the server in production mode
- `npm run lint`: Run the linter
- `npm test`: Run unit tests
- `npm run test:e2e`: Run end-to-end tests

## License
