import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { BrokerScope } from '../../common/decorators/broker-scope.decorator';
import {
  BrokerScopeGuard,
  type BrokerScopeContext,
} from '../../common/guards/broker-scope.guard';
import { BrokerPortalService } from './broker-portal.service';
import { BrokerPortalLeadsService } from './broker-portal-leads.service';
import { BrokerPortalVisitsService } from './broker-portal-visits.service';
import { BrokerPortalActivityService } from './broker-portal-activity.service';
import { BrokerPortalReservationsService } from './broker-portal-reservations.service';
import { BrokerPortalContractsService } from './broker-portal-contracts.service';
import { BrokerPortalCommissionsService } from './broker-portal-commissions.service';
import { BrokerPortalPayoutsService } from './broker-portal-payouts.service';
import { BrokerPortalPerformanceService } from './broker-portal-performance.service';
import { PortalUnitsQueryDto } from './dto/portal-query.dto';
import { PortalContractsQueryDto } from './dto/portal-contract.dto';
import { PortalCommissionsQueryDto } from './dto/portal-commission.dto';
import { PortalPayoutsQueryDto } from './dto/portal-payout.dto';
import { PortalPerformanceQueryDto } from './dto/portal-performance.dto';
import {
  CreatePortalLeadDto,
  PortalLeadsQueryDto,
} from './dto/portal-lead.dto';
import {
  CreatePortalVisitRequestDto,
  PortalVisitsQueryDto,
} from './dto/portal-visit.dto';
import { PortalActivityQueryDto } from './dto/portal-activity.dto';
import {
  CreatePortalReservationDto,
  PortalReservationsQueryDto,
} from './dto/portal-reservation.dto';

@ApiTags('broker-portal')
@Roles(UserRole.BROKER)
@UseGuards(BrokerScopeGuard)
@Controller('portal')
export class BrokerPortalController {
  constructor(
    private readonly portal: BrokerPortalService,
    private readonly portalLeads: BrokerPortalLeadsService,
    private readonly portalVisits: BrokerPortalVisitsService,
    private readonly portalActivity: BrokerPortalActivityService,
    private readonly portalReservations: BrokerPortalReservationsService,
    private readonly portalContracts: BrokerPortalContractsService,
    private readonly portalCommissions: BrokerPortalCommissionsService,
    private readonly portalPayouts: BrokerPortalPayoutsService,
    private readonly portalPerformance: BrokerPortalPerformanceService,
  ) {}

  @Get('me')
  me(@CurrentUser() auth: AuthUser, @BrokerScope() scope: BrokerScopeContext) {
    return this.portal.getMe(scope, auth);
  }

  @Get('profile')
  profile(@CurrentUser() auth: AuthUser, @BrokerScope() scope: BrokerScopeContext) {
    return this.portal.getMe(scope, auth);
  }

  @Get('projects')
  projects(@BrokerScope() scope: BrokerScopeContext) {
    return this.portal.listProjects(scope);
  }

  @Get('units')
  units(
    @BrokerScope() scope: BrokerScopeContext,
    @Query() query: PortalUnitsQueryDto,
  ) {
    return this.portal.listUnits(scope, query);
  }

  // ── Leads ─────────────────────────────────────────────────────────────

  @Get('leads')
  listLeads(
    @BrokerScope() scope: BrokerScopeContext,
    @Query() query: PortalLeadsQueryDto,
  ) {
    return this.portalLeads.list(scope, query);
  }

  @Post('leads')
  createLead(
    @BrokerScope() scope: BrokerScopeContext,
    @Body() dto: CreatePortalLeadDto,
  ) {
    return this.portalLeads.create(scope, dto);
  }

  @Get('leads/:id')
  getLead(
    @BrokerScope() scope: BrokerScopeContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.portalLeads.findOne(scope, id);
  }

  // ── Visits ────────────────────────────────────────────────────────────

  @Get('visits')
  listVisits(
    @BrokerScope() scope: BrokerScopeContext,
    @Query() query: PortalVisitsQueryDto,
  ) {
    return this.portalVisits.list(scope, query);
  }

  @Post('visits/requests')
  createVisitRequest(
    @BrokerScope() scope: BrokerScopeContext,
    @Body() dto: CreatePortalVisitRequestDto,
  ) {
    return this.portalVisits.createRequest(scope, dto);
  }

  // ── Activity timeline ─────────────────────────────────────────────────

  @Get('activity')
  listActivity(
    @BrokerScope() scope: BrokerScopeContext,
    @Query() query: PortalActivityQueryDto,
  ) {
    return this.portalActivity.list(scope, query);
  }

  // ── Reservations ───────────────────────────────────────────────────────

  @Get('reservations')
  listReservations(
    @BrokerScope() scope: BrokerScopeContext,
    @Query() query: PortalReservationsQueryDto,
  ) {
    return this.portalReservations.list(scope, query);
  }

  @Post('reservations')
  createReservation(
    @BrokerScope() scope: BrokerScopeContext,
    @Body() dto: CreatePortalReservationDto,
  ) {
    return this.portalReservations.create(scope, dto);
  }

  @Get('reservations/:id')
  getReservation(
    @BrokerScope() scope: BrokerScopeContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.portalReservations.findOne(scope, id);
  }

  // ── Contracts (read-only) ─────────────────────────────────────────────

  @Get('contracts')
  listContracts(
    @BrokerScope() scope: BrokerScopeContext,
    @Query() query: PortalContractsQueryDto,
  ) {
    return this.portalContracts.list(scope, query);
  }

  @Get('contracts/:id')
  getContract(
    @BrokerScope() scope: BrokerScopeContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.portalContracts.findOne(scope, id);
  }

  // ── Commissions (read-only) ───────────────────────────────────────────

  @Get('commissions')
  listCommissions(
    @BrokerScope() scope: BrokerScopeContext,
    @Query() query: PortalCommissionsQueryDto,
  ) {
    return this.portalCommissions.list(scope, query);
  }

  @Get('commissions/:id')
  getCommission(
    @BrokerScope() scope: BrokerScopeContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.portalCommissions.findOne(scope, id);
  }

  // ── Payouts (read-only) ───────────────────────────────────────────────

  @Get('payouts')
  listPayouts(
    @BrokerScope() scope: BrokerScopeContext,
    @Query() query: PortalPayoutsQueryDto,
  ) {
    return this.portalPayouts.list(scope, query);
  }

  @Get('payouts/:id')
  getPayout(
    @BrokerScope() scope: BrokerScopeContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.portalPayouts.findOne(scope, id);
  }

  // ── Performance (read-only) ───────────────────────────────────────────

  @Get('performance')
  performance(
    @BrokerScope() scope: BrokerScopeContext,
    @Query() query: PortalPerformanceQueryDto,
  ) {
    return this.portalPerformance.forBroker(scope, query);
  }

  @Get('performance/agents')
  performanceAgents(
    @BrokerScope() scope: BrokerScopeContext,
    @Query() query: PortalPerformanceQueryDto,
  ) {
    return this.portalPerformance.agents(scope, query);
  }

  @Get('performance/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="my-performance.csv"')
  performanceExport(
    @BrokerScope() scope: BrokerScopeContext,
    @Query() query: PortalPerformanceQueryDto,
  ) {
    return this.portalPerformance.exportCsv(scope, query);
  }
}
