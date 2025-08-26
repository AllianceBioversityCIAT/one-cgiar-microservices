import { Routes } from '@nestjs/core';
import { FileManagementModule } from './file-management/file-management.module';

export const ModuleRoutes: Routes = [
  {
    path: 'file-management',
    module: FileManagementModule,
  },
];
