import { RouteTree } from '@nestjs/core';
import { PdfModule } from '../api/pdf/pdf.module';

export const routes: RouteTree = {
  path: 'pdf',
  module: PdfModule,
};
