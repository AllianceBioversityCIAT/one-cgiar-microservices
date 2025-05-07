import { Routes } from '@nestjs/core';
import { ModuleRoutes } from './api/module.routes';

export const MainRoutes: Routes = [
  {
    path: 'api',
    children: ModuleRoutes,
  },
];
