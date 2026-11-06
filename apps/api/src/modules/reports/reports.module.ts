import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { LedgerService } from './ledger.service';
import { FinancialComparisonService } from './financial-comparison.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, LedgerService, FinancialComparisonService],
})
export class ReportsModule {}
