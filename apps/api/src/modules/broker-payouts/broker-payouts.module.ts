import { Module } from '@nestjs/common';
import { BrokerPayoutsService } from './broker-payouts.service';
import { BrokerPayoutsController } from './broker-payouts.controller';

@Module({
  controllers: [BrokerPayoutsController],
  providers: [BrokerPayoutsService],
  exports: [BrokerPayoutsService],
})
export class BrokerPayoutsModule {}
