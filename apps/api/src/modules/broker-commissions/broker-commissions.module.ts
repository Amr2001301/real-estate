import { Module } from '@nestjs/common';
import { BrokerCommissionsService } from './broker-commissions.service';
import { BrokerCommissionsController } from './broker-commissions.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [BrokerCommissionsController],
  providers: [BrokerCommissionsService],
  exports: [BrokerCommissionsService],
})
export class BrokerCommissionsModule {}
