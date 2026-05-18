import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
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

  @Get('export/top-brokers.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="top-brokers.csv"')
  topBrokersCsv(@Query() query: TopBrokersQueryDto) {
    return this.svc.topBrokersCsv(query);
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

  @Get('broker/:brokerId')
  brokerDetail(
    @Param('brokerId', ParseUUIDPipe) brokerId: string,
    @Query() query: BrokerDetailReportQueryDto,
  ) {
    return this.svc.brokerDetail(brokerId, query);
  }
}
