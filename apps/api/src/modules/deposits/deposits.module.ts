import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { MediaModule } from '../media/media.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DepositsService } from './deposits.service';
import { DepositsController } from './deposits.controller';

@Module({
  imports: [DocumentsModule, NotificationsModule, MediaModule],
  controllers: [DepositsController],
  providers: [DepositsService],
})
export class DepositsModule {}
