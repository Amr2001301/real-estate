import { Module } from '@nestjs/common';
import { BrokerAccessService } from './broker-access.service';
import { BrokerAccessController } from './broker-access.controller';

@Module({
  controllers: [BrokerAccessController],
  providers: [BrokerAccessService],
  exports: [BrokerAccessService],
})
export class BrokerAccessModule {}
