import { Global, Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { ReportBrandService } from './report-brand.service';

/**
 * Global so report producers (reports, broker reports, bonus, maintenance,
 * installments, branding) inject ReportBrandService without importing the
 * module. They take it as @Optional(): a unit test that builds a feature
 * module without this one gets a neutral, unbranded file instead of a DI error.
 */
@Global()
@Module({
  imports: [MediaModule],
  providers: [ReportBrandService],
  exports: [ReportBrandService],
})
export class ReportBrandModule {}
