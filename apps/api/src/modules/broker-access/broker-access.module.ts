import { Module } from '@nestjs/common';
import { BrokerAccessService } from './broker-access.service';
import { BrokerAccessController } from './broker-access.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [BrokerAccessController],
  providers: [BrokerAccessService],
  exports: [BrokerAccessService],
})
export class BrokerAccessModule {}
