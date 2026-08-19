import {
  Controller,
  Get,
  Header,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ReportsService } from './reports.service';
import { FinancialDashboardQueryDto } from './reports.dto';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  @Roles(UserRole.ADMIN)
  @Permissions('reports:operational:read')
  @Get('kpis')
  kpis() {
    return this.svc.kpis();
  }

  // P14 — single ADMIN-only feed for the /dashboard home (KPIs + reservation
  // trend + lead sources + recent activity + alert counts). CUSTOMER / CLIENT /
  // BROKER are rejected at @Roles; SALES / SALES_MANAGER get their own home.
  @Roles(UserRole.ADMIN)
  @Permissions('reports:operational:read')
  @Get('admin-summary')
  adminSummary() {
    return this.svc.adminSummary();
  }

  // P14.1 — downloadable CSV of the admin dashboard summary. Same data + same
  // ADMIN-only gate as /admin-summary; CUSTOMER / CLIENT / BROKER are rejected
  // at @Roles.
  @Roles(UserRole.ADMIN)
  @Permissions('reports:operational:read')
  @Get('admin-summary/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="admin-summary.csv"')
  adminSummaryCsv() {
    return this.svc.adminSummaryCsv();
  }

  // P14.2 — styled XLSX of the admin dashboard summary (default download).
  // Same data + same ADMIN-only gate; CUSTOMER / CLIENT / BROKER rejected at
  // @Roles. The CSV endpoint above stays as a raw-data fallback.
  @Roles(UserRole.ADMIN)
  @Permissions('reports:operational:read')
  @Get('admin-summary/export.xlsx')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header('Content-Disposition', 'attachment; filename="admin-summary.xlsx"')
  async adminSummaryXlsx(): Promise<StreamableFile> {
    return new StreamableFile(await this.svc.adminSummaryXlsx());
  }

  @Roles(UserRole.ADMIN)
  @Permissions('reports:sales:read')
  @Get('sales')
  sales(
    @Query('period') period?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.svc.sales(period, dateFrom, dateTo);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('reports:financial:read')
  @Get('financial')
  financial(
    @Query('period') period?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.svc.financial(period, dateFrom, dateTo);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('reports:operational:read')
  @Get('reservations')
  reservations(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.svc.reservations(dateFrom, dateTo);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('reports:sales:read')
  @Get('sales-trend')
  salesTrend(
    @Query('year') year?: string,
    @Query('projectId') projectId?: string,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.svc.salesTrend(y, projectId);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('reports:sales:read')
  @Get('sales-funnel')
  salesFunnel(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.svc.salesFunnel(dateFrom, dateTo);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('reports:sales:read')
  @Get('broker-leaderboard')
  brokerLeaderboard(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.svc.brokerLeaderboard(dateFrom, dateTo);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('reports:financial:read')
  @Get('financial-dashboard')
  financialDashboard(@Query() query: FinancialDashboardQueryDto) {
    return this.svc.financialDashboard({
      projectId: query.projectId,
      q: query.q,
      type: query.type,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });
  }

  // ── CSV exports ────────────────────────────────────────────────────────
  // Each returns a raw CSV string; @Header switches the response so the
  // browser treats the body as a download. Permissions mirror the matching
  // JSON read route exactly.

  @Roles(UserRole.ADMIN)
  @Permissions('reports:sales:read')
  @Get('sales/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="sales-report.csv"')
  salesCsv(
    @Query('period') period?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.svc.salesCsv(period, dateFrom, dateTo);
  }

  // P15.4 — board-style XLSX (default UI download). Same ADMIN + sales gate;
  // the CSV above stays as the raw-data fallback.
  @Roles(UserRole.ADMIN)
  @Permissions('reports:sales:read')
  @Get('sales/export.xlsx')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header('Content-Disposition', 'attachment; filename="sales-report.xlsx"')
  async salesXlsx(
    @Query('period') period?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<StreamableFile> {
    return new StreamableFile(await this.svc.salesBoardXlsx(period, dateFrom, dateTo));
  }

  @Roles(UserRole.ADMIN)
  @Permissions('reports:financial:read')
  @Get('financial/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="financial-report.csv"')
  financialCsv(
    @Query('period') period?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.svc.financialCsv(period, dateFrom, dateTo);
  }

  // P15.4 — board-style XLSX (default UI download). Same ADMIN + financial gate.
  @Roles(UserRole.ADMIN)
  @Permissions('reports:financial:read')
  @Get('financial/export.xlsx')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header('Content-Disposition', 'attachment; filename="financial-report.xlsx"')
  async financialXlsx(
    @Query('period') period?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<StreamableFile> {
    return new StreamableFile(await this.svc.financialBoardXlsx(period, dateFrom, dateTo));
  }

  @Roles(UserRole.ADMIN)
  @Permissions('reports:operational:read')
  @Get('operational/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="operational-report.csv"')
  operationalCsv() {
    return this.svc.operationalCsv();
  }

  // P15.3 — styled XLSX twin (default UI download). Same ADMIN-only gate; the
  // CSV above stays as the raw-data fallback.
  @Roles(UserRole.ADMIN)
  @Permissions('reports:operational:read')
  @Get('operational/export.xlsx')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header('Content-Disposition', 'attachment; filename="operational-report.xlsx"')
  async operationalXlsx(): Promise<StreamableFile> {
    return new StreamableFile(await this.svc.operationalXlsx());
  }

  @Roles(UserRole.ADMIN)
  @Permissions('reports:financial:read')
  @Get('financial-dashboard/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="financial-dashboard.csv"')
  financialDashboardCsv(@Query() query: FinancialDashboardQueryDto) {
    return this.svc.financialDashboardCsv({
      projectId: query.projectId,
      q: query.q,
      type: query.type,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });
  }

  // P15.4 — board-style XLSX (default UI download). Same ADMIN + financial gate
  // + filters; the CSV above stays as the raw-data fallback.
  @Roles(UserRole.ADMIN)
  @Permissions('reports:financial:read')
  @Get('financial-dashboard/export.xlsx')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header('Content-Disposition', 'attachment; filename="financial-dashboard.xlsx"')
  async financialDashboardXlsx(@Query() query: FinancialDashboardQueryDto): Promise<StreamableFile> {
    return new StreamableFile(
      await this.svc.financialDashboardXlsx({
        projectId: query.projectId,
        q: query.q,
        type: query.type,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      }),
    );
  }

  // ── PDF exports ──────────────────────────────────────────────────────────
  // Branded Arabic A4 PDFs (NotoSansArabic font) for sales, financial, and
  // broker reports. Same permission gates as the matching JSON read routes.

  @Roles(UserRole.ADMIN)
  @Permissions('reports:sales:read')
  @Get('sales/export.pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="sales-report.pdf"')
  async salesPdf(
    @Query('period') period?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<StreamableFile> {
    return new StreamableFile(await this.svc.salesPdf(period, dateFrom, dateTo));
  }

  @Roles(UserRole.ADMIN)
  @Permissions('reports:financial:read')
  @Get('financial/export.pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="financial-report.pdf"')
  async financialPdf(
    @Query('period') period?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<StreamableFile> {
    return new StreamableFile(await this.svc.financialPdf(period, dateFrom, dateTo));
  }

  @Roles(UserRole.ADMIN)
  @Permissions('reports:sales:read')
  @Get('broker-leaderboard/export.pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="broker-report.pdf"')
  async brokerPdf(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<StreamableFile> {
    return new StreamableFile(await this.svc.brokerPdf(dateFrom, dateTo));
  }
}
