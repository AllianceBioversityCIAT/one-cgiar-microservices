import { Test, TestingModule } from '@nestjs/testing';
import { MiningService } from './mining.service';
import {
  BedrockAgentRuntimeClient,
  RetrieveAndGenerateCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';
import { HttpException, HttpStatus } from '@nestjs/common';

jest.mock('@aws-sdk/client-bedrock-agent-runtime');

describe('MiningService', () => {
  let service: MiningService;
  let bedrockAgentRuntimeClient: BedrockAgentRuntimeClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MiningService],
    }).compile();

    service = module.get<MiningService>(MiningService);
    bedrockAgentRuntimeClient = service['bedrockAgentRuntimeClient'];
  });

  it('should create a mining process successfully', async () => {
    const mockResponse = {
      output: {
        text: 'Mock response text',
      },
    };

    (bedrockAgentRuntimeClient.send as jest.Mock).mockResolvedValueOnce(
      mockResponse,
    );

    const response = await service.create();

    expect(response).toEqual({
      response: 'Mock response text'
        .replace(/(\r\n|\n|\r)/gm, '<br>')
        .replace(/\s+/g, ' ')
        .replace(/1./g, '<br><br>1.'),
      status: HttpStatus.CREATED,
      message: 'Mining process created successfully.',
    });

    expect(bedrockAgentRuntimeClient.send).toHaveBeenCalledWith(
      expect.any(RetrieveAndGenerateCommand),
    );
  });

  it('should throw an HttpException if the mining process fails', async () => {
    const mockError = new Error('Failed to create mining process');

    (bedrockAgentRuntimeClient.send as jest.Mock).mockRejectedValueOnce(
      mockError,
    );

    try {
      await service.create();
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.message).toBe('Failed to create mining process');
      expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    }
  });
});
