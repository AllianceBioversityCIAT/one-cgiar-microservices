import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class OpenaiService {
  public readonly openAI: OpenAI;
  private readonly _logger = new Logger(OpenaiService.name);
  private readonly _openAIKey = process.env.OPENAI_API_KEY;

  constructor() {
    this.openAI = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
}
