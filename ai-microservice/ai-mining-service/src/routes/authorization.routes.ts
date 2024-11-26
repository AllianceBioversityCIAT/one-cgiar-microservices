import { RouteTree } from '@nestjs/core';
import { MiningModule } from '../module/mining/mining.module';

export const routes: RouteTree = {
  path: 'mining',
  module: MiningModule,
};
