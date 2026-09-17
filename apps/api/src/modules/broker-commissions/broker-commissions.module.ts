import { Module } from '@nestjs/common';
import { BrokerCommissionsService } from './broker-commissions.service';
import { BrokerCommissionsController } from './broker-commissions.controller';
import { ClawbackResolutionService } from './clawback-resolution.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [BrokerCommissionsController],
  providers: [BrokerCommissionsService, ClawbackResolutionService],
  exports: [BrokerCommissionsService, ClawbackResolutionService],
})
export class BrokerCommissionsModule {}
