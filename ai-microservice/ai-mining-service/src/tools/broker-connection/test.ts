import { Injectable } from '@nestjs/common';
import { BrokerConnectionBase } from './base/broker-connection';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class Test extends BrokerConnectionBase {
  constructor(configService: ConfigService) {
    super('cgiar_app_dev_mining_queue', configService);
  }
}
