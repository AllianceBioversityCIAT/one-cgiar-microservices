import { Module } from '@nestjs/common';
import { FileManagementService } from './file-management.service';
import { FileManagementController } from './file-management.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { ClarisaModule } from '../../tools/clarisa/clarisa.module';

@Module({
  controllers: [FileManagementController],
  providers: [FileManagementService],
  imports: [NotificationsModule, ClarisaModule],
  exports: [FileManagementService],
})
export class FileManagementModule {}
