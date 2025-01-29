import { Test, TestingModule } from '@nestjs/testing';
import { S3Service } from './s3.service';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import {
  BedrockAgentClient,
  StartIngestionJobCommand,
} from '@aws-sdk/client-bedrock-agent';
import { HttpException, HttpStatus } from '@nestjs/common';

jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/client-bedrock-agent');

describe('S3Service', () => {
  let service: S3Service;
  let s3Client: S3Client;
  let bedrockAgentClient: BedrockAgentClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [S3Service],
    }).compile();

    service = module.get<S3Service>(S3Service);
    s3Client = service['s3Client'];
    bedrockAgentClient = service['bedrockAgentClient'];
  });

  it('should upload a file and start an ingestion job', async () => {
    const mockFile = {
      originalname: 'testfile.txt',
      buffer: Buffer.from('file content'),
    } as Express.Multer.File;

    const uploadS3Response = { $metadata: { httpStatusCode: 200 } };
    const startIngestionJobResponse = { $metadata: { httpStatusCode: 200 } };

    (s3Client.send as jest.Mock).mockResolvedValueOnce(uploadS3Response);
    (bedrockAgentClient.send as jest.Mock).mockResolvedValueOnce(
      startIngestionJobResponse,
    );

    const response = await service.uploadFile(mockFile);

    expect(response).toEqual({
      response: {
        uploadS3: uploadS3Response,
        injestJob: startIngestionJobResponse,
        status: HttpStatus.CREATED,
        message: 'File uploaded successfully',
      },
    });
    expect(s3Client.send).toHaveBeenCalledWith(expect.any(PutObjectCommand));
    expect(bedrockAgentClient.send).toHaveBeenCalledWith(
      expect.any(StartIngestionJobCommand),
    );
  });

  it('should delete the file if upload fails', async () => {
    const mockFile = {
      originalname: 'testfile.txt',
      buffer: Buffer.from('file content'),
    } as Express.Multer.File;

    const uploadError = new Error('Upload failed');

    (s3Client.send as jest.Mock).mockRejectedValueOnce(uploadError);

    try {
      await service.uploadFile(mockFile);
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.message).toBe('Upload failed');
    }

    expect(s3Client.send).toHaveBeenCalledWith(expect.any(PutObjectCommand));
    expect(s3Client.send).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
  });
});
