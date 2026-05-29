import { Module } from '@nestjs/common';
import { BrokerPayoutsService } from './broker-payouts.service';
import { BrokerPayoutsController } from './broker-payouts.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [BrokerPayoutsController],
  providers: [BrokerPayoutsService],
  exports: [BrokerPayoutsService],
})
export class BrokerPayoutsModule {}
