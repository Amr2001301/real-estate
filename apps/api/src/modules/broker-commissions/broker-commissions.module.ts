import { Module } from '@nestjs/common';
import { BrokerCommissionsService } from './broker-commissions.service';
import { BrokerCommissionsController } from './broker-commissions.controller';

@Module({
  controllers: [BrokerCommissionsController],
  providers: [BrokerCommissionsService],
  exports: [BrokerCommissionsService],
})
export class BrokerCommissionsModule {}
