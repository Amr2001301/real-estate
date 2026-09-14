import {
  Body,
  Controller,
  Get,
  Header,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  Prisma,
  BonusEntryStatus,
  BonusEntrySource,
  UserRole,
  LeadStage,
  AppointmentStatus,
  ReservationStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toCsv } from '../../common/utils/csv';
import {
  addFooter,
  addTitledTable,
  createReportWorkbook,
  workbookToBuffer,
} from '../../common/utils/xlsx';
import {
  resolveSalesScope,
  salesActorIds,
  managerScopeIds,
  assertSalesRecordInScope,
} from '../../common/utils/sales-scope';
import { resolveTenantUser } from '../../common/tenant/resolve-tenant-entity';
import { getRequiredCompanyId } from '../../common/tenant/tenant-context';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions, PermissionsStrict } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

class CreateRuleDto {
  @IsString() name!: string;
  @IsNumber() @Min(0) @Max(100) percentage!: number;
  @IsOptional() @IsObject() conditions?: Record<string, unknown>;
  @IsOptional() @IsBoolean() active?: boolean;
  // Marks the rule as eligible for auto sales-commission generation on contract
  // signing (consumed in Batch B). Defaults false.
  @IsOptional() @IsBoolean() autoApplyOnSignedContract?: boolean;
}

// All fields optional — partial update/toggle of an existing rule.
class UpdateRuleDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) percentage?: number;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsBoolean() autoApplyOnSignedContract?: boolean;
}

class CreateEntryDto {
  @IsUUID() salesId!: string;
  @IsUUID() ruleId!: string;
  @IsNumber() @Min(0) amount!: number;
  @IsString() period!: string; // YYYY-MM
}

/**
 * PATCH /bonus-entries/:id is now the revert-to-PENDING route only.
 * APPROVED and PAID transitions live on their dedicated POST endpoints
 * (gated by @PermissionsStrict). The global ValidationPipe's
 * forbidNonWhitelisted + IsIn enforcement rejects other values with 400.
 */
class UpdateEntryStatusDto {
  @IsIn([BonusEntryStatus.PENDING]) status!: BonusEntryStatus;
}

class CreateTargetDto {
  @IsUUID() salesId!: string;
  @IsString() period!: string;
  @IsNumber() @Min(0) amountTarget!: number;
  @IsNumber() @Min(0) unitsTarget!: number;
}

// Read-only sales performance report. period is validated to YYYY-MM; salesId
// is honoured for ADMIN only (SALES is self-scoped server-side).
class PerformanceQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'period must be YYYY-MM' })
  period?: string;

  @IsOptional() @IsUUID() salesId?: string;
}

export interface SalesPerformanceRow {
  salesId: string;
  salesName: string;
  period: string;
  leadsCount: number;
  openLeadsCount: number;
  visitsCount: number;
  upcomingVisitsCount: number;
  reservationsCount: number;
  activeReservationsCount: number;
  convertedReservationsCount: number;
  signedContractsCount: number;
  realizedValue: number;
  targetAmount: number | null;
  targetUnits: number | null;
  achievedAmount: number;
  achievedUnits: number;
  targetAmountPercent: number | null;
  targetUnitsPercent: number | null;
}

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

function periodRange(period: string): { start: Date; end: Date } {
  const parts = period.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}

function pct(achieved: number, target: number | null): number | null {
  if (target === null || target <= 0) return null;
  return Math.round((achieved / target) * 100);
}

export interface SalesCommissionResult {
  status: 'created' | 'already_exists' | 'skipped';
  entryId?: string;
  reason?: 'not_signed' | 'no_reservation' | 'no_sales' | 'no_rule' | 'ambiguous_rules';
}

@Injectable()
export class BonusService {
  constructor(private readonly prisma: PrismaService) {}

  // Rules
  listRules() {
    return this.prisma.bonusRule.findMany({ orderBy: { createdAt: 'desc' } });
  }
  createRule(dto: CreateRuleDto) {
    const data = {
      name: dto.name,
      percentage: new Prisma.Decimal(dto.percentage),
      conditions: (dto.conditions ?? {}) as Prisma.InputJsonValue,
      active: dto.active ?? true,
      autoApplyOnSignedContract: dto.autoApplyOnSignedContract ?? false,
    };
    // Single-auto invariant (mirrors updateRule): creating a rule with auto ON
    // disables auto on every existing rule first, in one transaction. `active`
    // stays independent; no rules are deleted.
    if (data.autoApplyOnSignedContract === true) {
      return this.prisma.$transaction(async (tx) => {
        await tx.bonusRule.updateMany({
          where: { autoApplyOnSignedContract: true },
          data: { autoApplyOnSignedContract: false },
        });
        return tx.bonusRule.create({ data });
      });
    }
    return this.prisma.bonusRule.create({ data });
  }

  /**
   * Partial update / toggle of a rule. Enforces the single-auto invariant: when
   * autoApplyOnSignedContract is being turned ON, every OTHER rule's flag is
   * turned OFF in the same transaction (so generation never sees ambiguity).
   * Turning it OFF only touches this rule. Never mutates BonusEntry rows.
   */
  async updateRule(id: string, dto: UpdateRuleDto) {
    const existing = await this.prisma.bonusRule.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Bonus rule not found');

    const data: Prisma.BonusRuleUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.percentage !== undefined) data.percentage = new Prisma.Decimal(dto.percentage);
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.autoApplyOnSignedContract !== undefined) {
      data.autoApplyOnSignedContract = dto.autoApplyOnSignedContract;
    }

    if (dto.autoApplyOnSignedContract === true) {
      return this.prisma.$transaction(async (tx) => {
        await tx.bonusRule.updateMany({
          where: { id: { not: id }, autoApplyOnSignedContract: true },
          data: { autoApplyOnSignedContract: false },
        });
        return tx.bonusRule.update({ where: { id }, data });
      });
    }
    return this.prisma.bonusRule.update({ where: { id }, data });
  }

  // Entries
  createEntry(dto: CreateEntryDto) {
    return this.prisma.bonusEntry.create({
      data: {
        salesId: dto.salesId,
        ruleId: dto.ruleId,
        amount: new Prisma.Decimal(dto.amount),
        period: dto.period,
      },
    });
  }

  /**
   * Generate the automatic sales commission for a signed contract — mirrors
   * BrokerCommissionsService.materializeFromContract. Read-only/skip for every
   * unsafe case (never guesses, never throws for normal skips), and idempotent:
   * BonusEntry.contractId is unique, so at most one CONTRACT_AUTO entry exists
   * per contract. Generated entries are always PENDING; existing entries
   * (incl. APPROVED/PAID) are never mutated.
   */
  async materializeFromSignedContract(contractId: string): Promise<SalesCommissionResult> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        signedAt: true,
        totalAmount: true,
        reservationId: true,
        reservation: { select: { salesId: true } },
        bonusEntry: { select: { id: true } },
      },
    });
    if (!contract) return { status: 'skipped', reason: 'no_reservation' };

    // Idempotent: an auto entry already exists for this contract.
    if (contract.bonusEntry) {
      return { status: 'already_exists', entryId: contract.bonusEntry.id };
    }
    if (!contract.signedAt) return { status: 'skipped', reason: 'not_signed' };
    if (!contract.reservationId || !contract.reservation) {
      return { status: 'skipped', reason: 'no_reservation' };
    }
    const salesId = contract.reservation.salesId;
    if (!salesId) return { status: 'skipped', reason: 'no_sales' };

    // Exactly one active auto-apply rule may drive generation. Never guess.
    const rules = await this.prisma.bonusRule.findMany({
      where: { active: true, autoApplyOnSignedContract: true },
      select: { id: true, percentage: true },
    });
    if (rules.length === 0) return { status: 'skipped', reason: 'no_rule' };
    if (rules.length > 1) return { status: 'skipped', reason: 'ambiguous_rules' };
    const rule = rules[0]!;

    const basisAmount = contract.totalAmount;
    const amount = basisAmount.mul(rule.percentage).div(100);
    const period = contract.signedAt.toISOString().slice(0, 7);

    try {
      const created = await this.prisma.bonusEntry.create({
        data: {
          salesId,
          ruleId: rule.id,
          amount,
          period,
          status: BonusEntryStatus.PENDING,
          source: BonusEntrySource.CONTRACT_AUTO,
          contractId: contract.id,
          basisAmount,
          commissionPct: rule.percentage,
          paidAt: null,
        },
        select: { id: true },
      });
      return { status: 'created', entryId: created.id };
    } catch (e) {
      // Race: a parallel sign materialized the same contract first.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const existing = await this.prisma.bonusEntry.findUnique({
          where: { contractId: contract.id },
          select: { id: true },
        });
        if (existing) return { status: 'already_exists', entryId: existing.id };
      }
      throw e;
    }
  }

  listEntries(opts: {
    salesId?: string;
    salesIds?: string[];
    status?: BonusEntryStatus;
    period?: string;
  }) {
    return this.prisma.bonusEntry.findMany({
      where: {
        ...(opts.salesIds
          ? { salesId: { in: opts.salesIds } }
          : opts.salesId
            ? { salesId: opts.salesId }
            : {}),
        ...(opts.status ? { status: opts.status } : {}),
        ...(opts.period ? { period: opts.period } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { sales: { select: { id: true, fullName: true } }, rule: true },
    });
  }

  async entriesCsv(opts: { salesId?: string; status?: BonusEntryStatus; period?: string }) {
    const entries = await this.listEntries(opts);
    const statusLabel: Record<BonusEntryStatus, string> = {
      [BonusEntryStatus.PENDING]: 'معلق',
      [BonusEntryStatus.APPROVED]: 'معتمد',
      [BonusEntryStatus.PAID]: 'مدفوع',
    };
    const rows = entries.map((e) => [
      e.sales?.fullName ?? '',
      e.period,
      e.rule?.name ?? '',
      Number(e.amount),
      statusLabel[e.status],
      e.paidAt ? e.paidAt.toISOString().slice(0, 10) : '',
    ]);
    return toCsv(
      ['المندوب', 'الفترة', 'القاعدة', 'المبلغ', 'الحالة', 'تاريخ الدفع'],
      rows,
    );
  }

  /**
   * P15.3 — styled XLSX twin of entriesCsv. Same real list + same filters; the
   * applied filters are surfaced in the sheet header. No demo values.
   */
  async entriesXlsx(opts: { salesId?: string; status?: BonusEntryStatus; period?: string }) {
    const entries = await this.listEntries(opts);
    const statusLabel: Record<BonusEntryStatus, string> = {
      [BonusEntryStatus.PENDING]: 'معلق',
      [BonusEntryStatus.APPROVED]: 'معتمد',
      [BonusEntryStatus.PAID]: 'مدفوع',
    };
    const wb = createReportWorkbook();
    const ws = wb.addWorksheet('مكافآت المندوبين');
    addTitledTable(ws, {
      title: 'تقرير مكافآت المندوبين',
      filters: [
        ['الفترة', opts.period ?? ''],
        ['الحالة', opts.status ? statusLabel[opts.status] : ''],
        ['المندوب', opts.salesId ? 'مندوب محدد' : ''],
      ],
      headers: ['المندوب', 'الفترة', 'القاعدة', 'المبلغ', 'الحالة', 'تاريخ الدفع'],
      rows: entries.map((e) => [
        e.sales?.fullName ?? '',
        e.period,
        e.rule?.name ?? '',
        Number(e.amount),
        statusLabel[e.status],
        e.paidAt ? e.paidAt.toISOString().slice(0, 10) : '',
      ]),
      widths: [22, 12, 22, 16, 12, 16],
    });
    ws.getColumn(4).numFmt = '#,##0.##';
    addFooter(ws);
    return workbookToBuffer(wb);
  }

  setEntryStatus(id: string, dto: UpdateEntryStatusDto) {
    return this.prisma.bonusEntry.update({
      where: { id },
      data: {
        status: dto.status,
        paidAt: dto.status === BonusEntryStatus.PAID ? new Date() : null,
      },
    });
  }

  // Targets
  upsertTarget(dto: CreateTargetDto) {
    return this.prisma.salesTarget.upsert({
      where: { salesId_period: { salesId: dto.salesId, period: dto.period } },
      create: {
        salesId: dto.salesId,
        period: dto.period,
        amountTarget: new Prisma.Decimal(dto.amountTarget),
        unitsTarget: dto.unitsTarget,
      },
      update: {
        amountTarget: new Prisma.Decimal(dto.amountTarget),
        unitsTarget: dto.unitsTarget,
      },
    });
  }

  listTargets(opts: { salesId?: string; salesIds?: string[] }) {
    return this.prisma.salesTarget.findMany({
      where: opts.salesIds
        ? { salesId: { in: opts.salesIds } }
        : opts.salesId
          ? { salesId: opts.salesId }
          : {},
      orderBy: { period: 'desc' },
      include: { sales: { select: { id: true, fullName: true } } },
    });
  }

  // Read-only performance report. Aggregates existing CRM/sales data per rep for
  // a single period — no schema change, no commission generation. ADMIN may
  // target any rep (or all reps when salesId is omitted); SALES is always scoped
  // to itself (the salesId query param is ignored for SALES).
  async salesPerformance(opts: {
    role: UserRole;
    requesterId: string;
    salesId?: string;
    period?: string;
  }): Promise<SalesPerformanceRow[]> {
    const period = opts.period ?? currentPeriod();
    const { start, end } = periodRange(period);
    const now = new Date();
    const companyId = getRequiredCompanyId();

    // Rep scoping by role (sales actors = SALES + SALES_MANAGER):
    //   ADMIN         → any salesId, or all sales actors when none is given.
    //                   V-18: ADMIN-supplied salesId is validated via resolveTenantUser
    //                   before use — throws 404 if not in current tenant.
    //   SALES_MANAGER → self + team, or a single in-scope actor when a salesId
    //                   is given. Out-of-scope salesId ⇒ no rows.
    //   SALES (+ any other role) → self only; salesId is ignored.
    let repIds: string[];
    if (opts.role === UserRole.ADMIN) {
      if (opts.salesId) {
        await resolveTenantUser(this.prisma, opts.salesId, { id: true });
        repIds = [opts.salesId];
      } else {
        repIds = await salesActorIds(this.prisma);
      }
    } else if (opts.role === UserRole.SALES_MANAGER) {
      const scope = await managerScopeIds(this.prisma, opts.requesterId);
      repIds = opts.salesId ? (scope.includes(opts.salesId) ? [opts.salesId] : []) : scope;
    } else {
      repIds = [opts.requesterId];
    }
    if (repIds.length === 0) return [];

    const inReps = { in: repIds };
    const inPeriod = { gte: start, lt: end };

    const [
      users,
      targets,
      leadsPeriod,
      openLeads,
      visitsPeriod,
      upcomingVisits,
      reservationsPeriod,
      activeReservations,
      convertedReservations,
      signedContracts,
    ] = await Promise.all([
      // eslint-disable-next-line no-restricted-syntax -- companyId-scoped; ADMIN salesId pre-validated by resolveTenantUser (V-18)
      this.prisma.user.findMany({ where: { id: inReps, companyId }, select: { id: true, fullName: true } }),
      this.prisma.salesTarget.findMany({ where: { salesId: inReps, period } }),
      this.prisma.lead.groupBy({
        by: ['assignedSalesId'],
        where: { assignedSalesId: inReps, createdAt: inPeriod },
        _count: { _all: true },
      }),
      this.prisma.lead.groupBy({
        by: ['assignedSalesId'],
        where: { assignedSalesId: inReps, stage: { notIn: [LeadStage.WON, LeadStage.LOST] } },
        _count: { _all: true },
      }),
      this.prisma.visitAppointment.groupBy({
        by: ['assignedSalesId'],
        where: { assignedSalesId: inReps, scheduledAt: inPeriod },
        _count: { _all: true },
      }),
      this.prisma.visitAppointment.groupBy({
        by: ['assignedSalesId'],
        where: {
          assignedSalesId: inReps,
          scheduledAt: { gte: now },
          status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
        },
        _count: { _all: true },
      }),
      this.prisma.reservation.groupBy({
        by: ['salesId'],
        where: { salesId: inReps, createdAt: inPeriod },
        _count: { _all: true },
      }),
      this.prisma.reservation.groupBy({
        by: ['salesId'],
        where: { salesId: inReps, status: { in: [ReservationStatus.PENDING, ReservationStatus.APPROVED] } },
        _count: { _all: true },
      }),
      this.prisma.reservation.groupBy({
        by: ['salesId'],
        where: { salesId: inReps, status: ReservationStatus.CONVERTED, convertedAt: inPeriod },
        _count: { _all: true },
      }),
      // Contract has no direct salesId — attribute via its reservation. Signed
      // contracts in the period give the realized value/units (primary signal);
      // convertedReservationsCount is kept as a documented cross-check/fallback.
      this.prisma.contract.findMany({
        where: { signedAt: inPeriod, reservation: { salesId: inReps } },
        select: { totalAmount: true, reservation: { select: { salesId: true } } },
      }),
    ]);

    type Grouped<K extends string> = Array<Record<K, string | null> & { _count: { _all: number } }>;
    const countMap = <K extends string>(rows: Grouped<K>, key: K): Map<string, number> => {
      const m = new Map<string, number>();
      for (const row of rows) {
        const id = row[key];
        if (id) m.set(id, row._count._all);
      }
      return m;
    };

    const leadsMap = countMap(leadsPeriod as Grouped<'assignedSalesId'>, 'assignedSalesId');
    const openLeadsMap = countMap(openLeads as Grouped<'assignedSalesId'>, 'assignedSalesId');
    const visitsMap = countMap(visitsPeriod as Grouped<'assignedSalesId'>, 'assignedSalesId');
    const upcomingMap = countMap(upcomingVisits as Grouped<'assignedSalesId'>, 'assignedSalesId');
    const resMap = countMap(reservationsPeriod as Grouped<'salesId'>, 'salesId');
    const activeResMap = countMap(activeReservations as Grouped<'salesId'>, 'salesId');
    const convertedMap = countMap(convertedReservations as Grouped<'salesId'>, 'salesId');

    const signedCountMap = new Map<string, number>();
    const realizedMap = new Map<string, number>();
    for (const c of signedContracts as Array<{
      totalAmount: Prisma.Decimal;
      reservation: { salesId: string } | null;
    }>) {
      const sid = c.reservation?.salesId;
      if (!sid) continue;
      signedCountMap.set(sid, (signedCountMap.get(sid) ?? 0) + 1);
      realizedMap.set(sid, (realizedMap.get(sid) ?? 0) + Number(c.totalAmount));
    }

    const targetMap = new Map<string, { amount: number; units: number }>();
    for (const t of targets as Array<{ salesId: string; amountTarget: Prisma.Decimal; unitsTarget: number }>) {
      targetMap.set(t.salesId, { amount: Number(t.amountTarget), units: t.unitsTarget });
    }
    const nameMap = new Map<string, string>();
    for (const u of users) nameMap.set(u.id, u.fullName);

    return repIds
      .map((id): SalesPerformanceRow => {
        const target = targetMap.get(id) ?? null;
        const realizedValue = realizedMap.get(id) ?? 0;
        const signedContractsCount = signedCountMap.get(id) ?? 0;
        const targetAmount = target ? target.amount : null;
        const targetUnits = target ? target.units : null;
        return {
          salesId: id,
          salesName: nameMap.get(id) ?? '—',
          period,
          leadsCount: leadsMap.get(id) ?? 0,
          openLeadsCount: openLeadsMap.get(id) ?? 0,
          visitsCount: visitsMap.get(id) ?? 0,
          upcomingVisitsCount: upcomingMap.get(id) ?? 0,
          reservationsCount: resMap.get(id) ?? 0,
          activeReservationsCount: activeResMap.get(id) ?? 0,
          convertedReservationsCount: convertedMap.get(id) ?? 0,
          signedContractsCount,
          realizedValue,
          targetAmount,
          targetUnits,
          achievedAmount: realizedValue,
          achievedUnits: signedContractsCount,
          targetAmountPercent: pct(realizedValue, targetAmount),
          targetUnitsPercent: pct(signedContractsCount, targetUnits),
        };
      })
      .sort((a, b) => a.salesName.localeCompare(b.salesName, 'ar'));
  }
}

@ApiTags('bonus')
@Controller()
class BonusController {
  constructor(
    private readonly svc: BonusService,
    private readonly prisma: PrismaService,
  ) {}

  // Rules
  @Roles(UserRole.ADMIN)
  @Permissions('bonus:rules:manage')
  @Get('bonus-rules')
  listRules() {
    return this.svc.listRules();
  }

  @Roles(UserRole.ADMIN)
  @Permissions('bonus:rules:manage')
  @Post('bonus-rules')
  createRule(@Body() dto: CreateRuleDto) {
    return this.svc.createRule(dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('bonus:rules:manage')
  @Patch('bonus-rules/:id')
  updateRule(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRuleDto) {
    return this.svc.updateRule(id, dto);
  }

  // Entries
  @Roles(UserRole.ADMIN)
  @Permissions('bonus:entries:create')
  @Post('bonus-entries')
  createEntry(@Body() dto: CreateEntryDto) {
    return this.svc.createEntry(dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('bonus:entries:read')
  @Get('bonus-entries')
  async listEntries(
    @CurrentUser() user: AuthUser,
    @Query('salesId') salesId?: string,
    @Query('status') status?: BonusEntryStatus,
    @Query('period') period?: string,
  ) {
    const scope = await resolveSalesScope(this.prisma, user, salesId);
    return this.svc.listEntries({ ...scope, status, period });
  }

  // CSV export mirrors the list read permission. ADMIN-only — this is the
  // admin compensation export; SALES self-view (Batch 4) is out of scope.
  @Roles(UserRole.ADMIN)
  @Permissions('bonus:entries:read')
  @Get('bonus-entries/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="bonus-entries.csv"')
  entriesCsv(
    @Query('salesId') salesId?: string,
    @Query('status') status?: BonusEntryStatus,
    @Query('period') period?: string,
  ) {
    return this.svc.entriesCsv({ salesId, status, period });
  }

  // P15.3 — styled XLSX twin (default UI download). Same ADMIN-only gate +
  // filters; the CSV above stays as the raw-data fallback.
  @Roles(UserRole.ADMIN)
  @Permissions('bonus:entries:read')
  @Get('bonus-entries/export.xlsx')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header('Content-Disposition', 'attachment; filename="bonus-entries.xlsx"')
  async entriesXlsx(
    @Query('salesId') salesId?: string,
    @Query('status') status?: BonusEntryStatus,
    @Query('period') period?: string,
  ): Promise<StreamableFile> {
    return new StreamableFile(await this.svc.entriesXlsx({ salesId, status, period }));
  }

  // Strict: approval recognises the bonus as payable. Segregation of duties
  // — separate the admin who creates entries from the admin who approves.
  @Roles(UserRole.ADMIN)
  @PermissionsStrict('bonus:entries:approve')
  @Post('bonus-entries/:id/approve')
  approveEntry(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.setEntryStatus(id, { status: BonusEntryStatus.APPROVED });
  }

  // Strict: stamps paidAt — the persisted record of payment.
  @Roles(UserRole.ADMIN)
  @PermissionsStrict('bonus:entries:pay')
  @Post('bonus-entries/:id/pay')
  payEntry(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.setEntryStatus(id, { status: BonusEntryStatus.PAID });
  }

  // Revert-only path. DTO is narrowed to accept ONLY status: PENDING. The
  // global ValidationPipe rejects any other value with 400.
  @Roles(UserRole.ADMIN)
  @Permissions('bonus:entries:approve')
  @Patch('bonus-entries/:id')
  setEntryStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEntryStatusDto) {
    return this.svc.setEntryStatus(id, dto);
  }

  // Targets
  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER)
  @Permissions('targets:manage')
  @Post('sales-targets')
  async upsertTarget(@CurrentUser() user: AuthUser, @Body() dto: CreateTargetDto) {
    // SALES_MANAGER may only set targets for salesIds within their own scope
    // (self + direct team members). ADMIN is unrestricted.
    if (user.role !== UserRole.ADMIN) {
      await assertSalesRecordInScope(this.prisma, user, dto.salesId, { mode: 'forbidden' });
    }
    return this.svc.upsertTarget(dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('targets:read')
  @Get('sales-targets')
  async listTargets(@CurrentUser() user: AuthUser, @Query('salesId') salesId?: string) {
    const scope = await resolveSalesScope(this.prisma, user, salesId);
    return this.svc.listTargets(scope);
  }

  // Returns the set of users this actor may set targets for.
  // ADMIN → all SALES + SALES_MANAGER users.
  // SALES_MANAGER → themselves + their direct team (managerScopeIds).
  // Uses targets:read (not targets:manage) so it works even when the manage
  // permission hasn't been seeded yet for older SALES_MANAGER accounts.
  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER)
  @Permissions('targets:read')
  @Get('sales-targets/actors')
  async listTargetActors(@CurrentUser() user: AuthUser) {
    if (user.role === UserRole.ADMIN) {
      // eslint-disable-next-line no-restricted-syntax -- role-only filter; no caller-supplied id; cross-tenant fan-out is V-20 (tracked)
      return this.prisma.user.findMany({
        where: { role: { in: [UserRole.SALES, UserRole.SALES_MANAGER] } },
        select: { id: true, fullName: true, role: true },
        orderBy: { fullName: 'asc' },
      });
    }
    const ids = await managerScopeIds(this.prisma, user.sub);
    // eslint-disable-next-line no-restricted-syntax -- IDs from managerScopeIds(user.sub); no caller-supplied id
    return this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, fullName: true, role: true },
      orderBy: { fullName: 'asc' },
    });
  }

  // Read-only target-achievement / performance report. Reuses targets:read so
  // both ADMIN and SALES reach it; SALES is self-scoped in the service.
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('targets:read')
  @Get('sales-targets/performance')
  salesPerformance(@CurrentUser() user: AuthUser, @Query() query: PerformanceQueryDto) {
    return this.svc.salesPerformance({
      role: user.role,
      requesterId: user.sub,
      salesId: query.salesId,
      period: query.period,
    });
  }
}

@Module({
  controllers: [BonusController],
  providers: [BonusService],
  exports: [BonusService],
})
export class BonusModule {}
