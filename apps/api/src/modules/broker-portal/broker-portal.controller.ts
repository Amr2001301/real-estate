import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { BrokerScope } from '../../common/decorators/broker-scope.decorator';
import { RequireCapability } from '../../common/decorators/require-capability.decorator';
import {
  BrokerScopeGuard,
  type BrokerScopeContext,
} from '../../common/guards/broker-scope.guard';
import { BrokerManagerGuard } from '../../common/guards/broker-manager.guard';
import { BrokerCommissionsViewerGuard } from '../../common/guards/broker-commissions-viewer.guard';
import { BrokerPortalService } from './broker-portal.service';
import { BrokerPortalLeadsService } from './broker-portal-leads.service';
import { BrokerPortalVisitsService } from './broker-portal-visits.service';
import { BrokerPortalActivityService } from './broker-portal-activity.service';
import { BrokerPortalReservationsService } from './broker-portal-reservations.service';
import { BrokerPortalContractsService } from './broker-portal-contracts.service';
import { BrokerPortalCommissionsService } from './broker-portal-commissions.service';
import { BrokerPortalPayoutsService } from './broker-portal-payouts.service';
import { BrokerPortalPerformanceService } from './broker-portal-performance.service';
import { BrokerPortalTeamService } from './broker-portal-team.service';
import { PortalUnitsQueryDto } from './dto/portal-query.dto';
import {
  CreatePortalTeamMemberDto,
  PortalTeamQueryDto,
  UpdatePortalTeamMemberDto,
  UpdatePortalTeamMemberStatusDto,
} from './dto/portal-team.dto';
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
@RequireCapability('feature.brokers')
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
    private readonly portalTeam: BrokerPortalTeamService,
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

  // Declared before `reservations/:id` so the literal segment wins over the
  // UUID param route. Returns the active booking plans for a unit so the
  // broker form can show the booking amount before submitting.
  @Get('reservations/plan-options')
  reservationPlanOptions(
    @BrokerScope() scope: BrokerScopeContext,
    @Query('unitId', ParseUUIDPipe) unitId: string,
  ) {
    return this.portalReservations.listBookingPlansForUnit(scope, unitId);
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
  // Gated by BrokerCommissionsViewerGuard — only broker users whose
  // `canViewCommissions` flag is true may read financial endpoints.

  @Get('commissions')
  @UseGuards(BrokerCommissionsViewerGuard)
  listCommissions(
    @BrokerScope() scope: BrokerScopeContext,
    @Query() query: PortalCommissionsQueryDto,
  ) {
    return this.portalCommissions.list(scope, query);
  }

  @Get('commissions/:id')
  @UseGuards(BrokerCommissionsViewerGuard)
  getCommission(
    @BrokerScope() scope: BrokerScopeContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.portalCommissions.findOne(scope, id);
  }

  // ── Payouts (read-only) ───────────────────────────────────────────────

  @Get('payouts')
  @UseGuards(BrokerCommissionsViewerGuard)
  listPayouts(
    @BrokerScope() scope: BrokerScopeContext,
    @Query() query: PortalPayoutsQueryDto,
  ) {
    return this.portalPayouts.list(scope, query);
  }

  @Get('payouts/:id')
  @UseGuards(BrokerCommissionsViewerGuard)
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

  // P15.5 — styled XLSX twin (default UI download). Same BROKER role +
  // BrokerScopeGuard + per-agent scoping; the CSV above stays the raw fallback.
  // The broker firm is always scope.brokerId (from the token), so a broker can
  // only export their own performance — no cross-broker access.
  @Get('performance/export.xlsx')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header('Content-Disposition', 'attachment; filename="my-performance.xlsx"')
  async performanceExportXlsx(
    @BrokerScope() scope: BrokerScopeContext,
    @Query() query: PortalPerformanceQueryDto,
  ): Promise<StreamableFile> {
    return new StreamableFile(await this.portalPerformance.exportXlsx(scope, query));
  }

  // ── Team management ───────────────────────────────────────────────────
  // Gated by BrokerManagerGuard — only the primary contact or users with
  // `canManageBrokerUsers=true` may reach these routes.

  @Get('team')
  @UseGuards(BrokerManagerGuard)
  listTeam(
    @BrokerScope() scope: BrokerScopeContext,
    @Query() query: PortalTeamQueryDto,
  ) {
    return this.portalTeam.list(scope, query);
  }

  @Post('team')
  @UseGuards(BrokerManagerGuard)
  createTeamMember(
    @BrokerScope() scope: BrokerScopeContext,
    @Body() dto: CreatePortalTeamMemberDto,
  ) {
    return this.portalTeam.create(scope, dto);
  }

  @Get('team/:id')
  @UseGuards(BrokerManagerGuard)
  getTeamMember(
    @BrokerScope() scope: BrokerScopeContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.portalTeam.findOne(scope, id);
  }

  @Patch('team/:id')
  @UseGuards(BrokerManagerGuard)
  updateTeamMember(
    @BrokerScope() scope: BrokerScopeContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePortalTeamMemberDto,
  ) {
    return this.portalTeam.update(scope, id, dto);
  }

  @Patch('team/:id/status')
  @UseGuards(BrokerManagerGuard)
  updateTeamMemberStatus(
    @BrokerScope() scope: BrokerScopeContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePortalTeamMemberStatusDto,
  ) {
    return this.portalTeam.updateStatus(scope, id, dto);
  }
}
