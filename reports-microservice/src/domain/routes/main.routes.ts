import { Routes } from '@nestjs/core';
import { routes as auth } from './authorization.routes';

export const routes: Routes = [
  {
    path: 'api/reports',
    children: [auth],
  },
];
