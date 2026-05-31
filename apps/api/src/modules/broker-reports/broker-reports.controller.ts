import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { BrokerReportsService } from './broker-reports.service';
import {
  AgentsReportQueryDto,
  BrokerDetailReportQueryDto,
  BrokerReportsSummaryQueryDto,
  ProjectsReportQueryDto,
  TopBrokersQueryDto,
} from './dto/broker-report.dto';

@ApiTags('broker-reports')
@Roles(UserRole.ADMIN)
// Controller-level: every report read + CSV export route requires this code.
// PermissionsGuard resolves via getAllAndOverride([handler, class]), so a
// per-route decorator could still override this if ever needed.
@Permissions('broker_reports:read')
@Controller('broker-reports')
export class BrokerReportsController {
  constructor(private readonly svc: BrokerReportsService) {}

  @Get('summary')
  summary(@Query() query: BrokerReportsSummaryQueryDto) {
    return this.svc.summary(query);
  }

  @Get('top-brokers')
  topBrokers(@Query() query: TopBrokersQueryDto) {
    return this.svc.topBrokers(query);
  }

  @Get('agents')
  agents(@Query() query: AgentsReportQueryDto) {
    return this.svc.agents(query);
  }

  @Get('projects')
  projects(@Query() query: ProjectsReportQueryDto) {
    return this.svc.projects(query);
  }

  // CSV exports. Each returns a raw CSV string; @Header switches the
  // response Content-Type so the browser treats the body as a download.
  @Get('export/summary.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="broker-summary.csv"')
  summaryCsv(@Query() query: BrokerReportsSummaryQueryDto) {
    return this.svc.summaryCsv(query);
  }

  // P15.4 — board-style XLSX (default UI download). Controller-level
  // @Roles(ADMIN) + @Permissions('broker_reports:read') still apply; the CSV
  // above stays as the raw-data fallback.
  @Get('export/summary.xlsx')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header('Content-Disposition', 'attachment; filename="broker-summary.xlsx"')
  async summaryXlsx(@Query() query: BrokerReportsSummaryQueryDto): Promise<StreamableFile> {
    return new StreamableFile(await this.svc.summaryBoardXlsx(query));
  }

  @Get('export/top-brokers.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="top-brokers.csv"')
  topBrokersCsv(@Query() query: TopBrokersQueryDto) {
    return this.svc.topBrokersCsv(query);
  }

  // P15.3 — styled XLSX twin (default UI download). Controller-level
  // @Roles(ADMIN) + @Permissions('broker_reports:read') still apply; the CSV
  // above stays as the raw-data fallback.
  @Get('export/top-brokers.xlsx')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header('Content-Disposition', 'attachment; filename="top-brokers.xlsx"')
  async topBrokersXlsx(@Query() query: TopBrokersQueryDto): Promise<StreamableFile> {
    return new StreamableFile(await this.svc.topBrokersXlsx(query));
  }

  // Note: `broker/:brokerId` is declared LAST so the literal segments above
  // (summary/top-brokers/agents/projects/export/*) are matched first.
  @Get('export/broker/:brokerId.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="broker-detail.csv"')
  brokerDetailCsv(
    @Param('brokerId', ParseUUIDPipe) brokerId: string,
    @Query() query: BrokerDetailReportQueryDto,
  ) {
    return this.svc.brokerDetailCsv(brokerId, query);
  }

  // P15.3 — styled XLSX twin (default UI download). Same controller-level gate;
  // the CSV above stays as the raw-data fallback.
  @Get('export/broker/:brokerId.xlsx')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header('Content-Disposition', 'attachment; filename="broker-detail.xlsx"')
  async brokerDetailXlsx(
    @Param('brokerId', ParseUUIDPipe) brokerId: string,
    @Query() query: BrokerDetailReportQueryDto,
  ): Promise<StreamableFile> {
    return new StreamableFile(await this.svc.brokerDetailXlsx(brokerId, query));
  }

  @Get('broker/:brokerId')
  brokerDetail(
    @Param('brokerId', ParseUUIDPipe) brokerId: string,
    @Query() query: BrokerDetailReportQueryDto,
  ) {
    return this.svc.brokerDetail(brokerId, query);
  }
}
