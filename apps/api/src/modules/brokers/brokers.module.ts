import { Module } from '@nestjs/common';
import { BrokerAgreementCron, BrokersService } from './brokers.service';
import { BrokersController } from './brokers.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { BrokerCommissionsModule } from '../broker-commissions/broker-commissions.module';

@Module({
  imports: [NotificationsModule, BrokerCommissionsModule],
  controllers: [BrokersController],
  providers: [BrokersService, BrokerAgreementCron],
  exports: [BrokersService],
})
export class BrokersModule {}
