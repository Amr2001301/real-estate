import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { MediaModule } from '../media/media.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DepositsService } from './deposits.service';
import { DepositsController } from './deposits.controller';

import { OwnershipModule } from '../../common/ownership/ownership.module';
@Module({
  imports: [DocumentsModule, NotificationsModule, MediaModule, OwnershipModule],
  controllers: [DepositsController],
  providers: [DepositsService],
})
export class DepositsModule {}
