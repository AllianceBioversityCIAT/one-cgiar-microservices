import { Routes } from '@nestjs/core';
import { ModulesRoutes } from './module/modules.routes';

export const MainRoutes: Routes = [
  {
    path: '/api',
    children: ModulesRoutes,
  },
];
