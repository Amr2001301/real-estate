import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { LedgerService } from './ledger.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, LedgerService],
})
export class ReportsModule {}
