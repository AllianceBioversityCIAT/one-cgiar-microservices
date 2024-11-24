import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  BedrockAgentRuntimeClient,
  RetrieveAndGenerateCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';
import { env } from 'process';

@Injectable()
export class MiningService {
  public bedrockAgentRuntimeClient: BedrockAgentRuntimeClient;

  constructor() {
    this.bedrockAgentRuntimeClient = new BedrockAgentRuntimeClient({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  async create() {
    const enumType: any = env.KNOWLEDGE_BASE;
    const prompt = `
      Describe an innovative idea, product, service, technology, or process. It can be something that exists or a new proposal. For each innovation, please list the following:
      1. Name: Brief name or title.
      2. Type: New innovation or improvement.
      3. Description: Details of the innovation.
      4. Uniqueness: What makes it unique compared to existing solutions?
      5. Contribution: How does it contribute to progress or solve a problem?
      6. Advantages: Aspects that make it more effective, sustainable, or equitable.
      7. Scalability: Potential to be scaled or applied in different contexts.
      8. Improvements: Possible changes to increase impact or feasibility.
    `;

    const input = {
      input: {
        text: prompt,
      },
      retrieveAndGenerateConfiguration: {
        type: enumType,
        knowledgeBaseConfiguration: {
          knowledgeBaseId: env.BEDROCK_KNOWLEDGE_BASE_ID,
          modelArn: env.BEDROCK_MODEL_ID,
          // retrievalConfiguration: {
          //   vectorSearchConfiguration: {
          //     filter: {
          //       equals: {
          //         key: 'STRING_VALUE',
          //         value: 'DOCUMENT_VALUE',
          //       },
          //     },
          //   },
          // },
        },
      },
    };

    try {
      const command = new RetrieveAndGenerateCommand(input);
      const response = await this.bedrockAgentRuntimeClient.send(command);
      return {
        response: response.output.text
          .replace(/(\r\n|\n|\r)/gm, '<br>')
          .replace(/\s+/g, ' ')
          .replace(/1./g, '<br><br>1.'),
        status: HttpStatus.CREATED,
        message: 'Mining process created successfully.',
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
