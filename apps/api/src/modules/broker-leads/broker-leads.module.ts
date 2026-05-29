import { Module } from '@nestjs/common';
import { BrokerLeadsService } from './broker-leads.service';
import { BrokerLeadsController } from './broker-leads.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [BrokerLeadsController],
  providers: [BrokerLeadsService],
  exports: [BrokerLeadsService],
})
export class BrokerLeadsModule {}
