import { Routes } from '@nestjs/core';
import { FileManagementModule } from './file-management/file-management.module';
import { PdfModule } from './pdf/pdf.module';

export const ModuleRoutes: Routes = [
  {
    path: 'file-management',
    module: FileManagementModule,
  },
  {
    path: 'pdf',
    module: PdfModule,
  },
];
