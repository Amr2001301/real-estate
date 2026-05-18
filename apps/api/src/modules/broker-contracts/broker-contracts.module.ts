import { Module } from '@nestjs/common';
import { BrokerContractsService } from './broker-contracts.service';
import { BrokerContractsController } from './broker-contracts.controller';

@Module({
  controllers: [BrokerContractsController],
  providers: [BrokerContractsService],
  exports: [BrokerContractsService],
})
export class BrokerContractsModule {}
