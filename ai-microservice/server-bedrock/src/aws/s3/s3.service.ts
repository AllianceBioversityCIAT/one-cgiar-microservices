import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { env } from 'process';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  BedrockAgentClient,
  StartIngestionJobCommand,
} from '@aws-sdk/client-bedrock-agent';
import { stat } from 'fs';

@Injectable()
export class S3Service {
  private readonly s3Client: S3Client;
  private readonly bedrockAgentClient: BedrockAgentClient;

  config = {
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  };

  constructor() {
    this.s3Client = new S3Client(this.config);
    this.bedrockAgentClient = new BedrockAgentClient(this.config);
  }

  async uploadFile(file: Express.Multer.File) {
    const bucketName = env.BUCKET_NAME;
    const key = `${Date.now()}-${file.originalname.replace(/\s/g, '')}`;

    const uploadParams = {
      Bucket: bucketName,
      Key: key,
      Body: file.buffer,
    };
    const injestParams = {
      knowledgeBaseId: env.BEDROCK_KNOWLEDGE_BASE_ID,
      dataSourceId: env.KNOWLEDGE_BASE_DATA_SOURCE_ID,
    };

    try {
      const uploadS3 = await this.s3Client.send(
        new PutObjectCommand(uploadParams),
      );

      if (uploadS3) {
        const startIngestionJobCommand = new StartIngestionJobCommand(
          injestParams,
        );
        const injestJob = await this.bedrockAgentClient.send(
          startIngestionJobCommand,
        );

        return {
          response: {
            uploadS3,
            injestJob,
            status: HttpStatus.CREATED,
            message: 'File uploaded successfully',
          },
        };
      }
    } catch (error) {
      await this.deleteFile(bucketName, key);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async deleteFile(bucket: string, key: string) {
    const deleteParams = {
      Bucket: bucket,
      Key: key,
    };
    try {
      await this.s3Client.send(new DeleteObjectCommand(deleteParams));
    } catch (deleteError) {
      throw new HttpException(
        deleteError.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
