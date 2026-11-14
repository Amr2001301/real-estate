import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';
import { DealTargetsService } from './deal-targets.service';

@Module({
  imports: [NotificationsModule],
  controllers: [DealsController],
  providers: [DealsService, DealTargetsService],
  exports: [DealsService, DealTargetsService],
})
export class DealsModule {}
