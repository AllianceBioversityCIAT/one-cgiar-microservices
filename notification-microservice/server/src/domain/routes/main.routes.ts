import { Routes } from '@nestjs/core';
import { routes as authorization } from './authorization.routes';

export const routes: Routes = [
  {
    path: 'api',
    children: [authorization],
  },
];
