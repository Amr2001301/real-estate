import { Module } from '@nestjs/common';
import { BrokerReportsService } from './broker-reports.service';
import { BrokerReportsController } from './broker-reports.controller';

@Module({
  controllers: [BrokerReportsController],
  providers: [BrokerReportsService],
  exports: [BrokerReportsService],
})
export class BrokerReportsModule {}
