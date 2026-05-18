import { Module } from '@nestjs/common';
import { BrokerLeadsService } from './broker-leads.service';
import { BrokerLeadsController } from './broker-leads.controller';

@Module({
  controllers: [BrokerLeadsController],
  providers: [BrokerLeadsService],
  exports: [BrokerLeadsService],
})
export class BrokerLeadsModule {}
