import { Global, Module } from '@nestjs/common';
import { ReportPdfService } from './report-pdf.service';

/**
 * Global so report producers inject ReportPdfService without importing the
 * module. They take it as @Optional(): a unit test that builds a feature
 * module without this one gets the PDFKit fallback instead of a DI error.
 */
@Global()
@Module({
  providers: [ReportPdfService],
  exports: [ReportPdfService],
})
export class ReportPdfModule {}
