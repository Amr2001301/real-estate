import { Injectable } from '@nestjs/common';
import {
  AppointmentStatus,
  BonusEntryStatus,
  BrokerCommissionStatus,
  BrokerPayoutStatus,
  DepositReviewStatus,
  DepositType,
  DocumentCategory,
  DocumentOwnerType,
  InfoRequestStatus,
  InstallmentStatus,
  MaintenanceStatus,
  Prisma,
  ReservationStatus,
  UnitStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getRequiredCompanyId } from '../../common/tenant/tenant-context';
import { toCsv, type CsvCell } from '../../common/utils/csv';
import {
  buildBrokerPdf,
  buildFinancialPdf,
  buildSalesPdf,
} from '../../common/utils/pdf';
import {
  XLSX_ALERT_BG,
  addBoardBanner,
  addChartBlock,
  addFooter,
  addKpiCards,
  addSectionTitle,
  addTable,
  addTitledTable,
  createReportWorkbook,
  setupBoardSheet,
  styleTotalsRow,
  workbookToBuffer,
} from '../../common/utils/xlsx';
import {
  renderBarChartPng,
  renderDoughnutChartPng,
} from '../../common/utils/xlsx-chart';
import { brandLogoPng } from '../../common/utils/brand';

// Arabic month names indexed by JS month (0 = January). Used for the
// reservation-trend labels on the admin dashboard.
const AR_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
] as const;

/** Resolve an Arabic label from a translatable `{ ar, en }` JSON or a string. */
function translatableAr(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'string') return v;
  const t = v as { ar?: string; en?: string };
  return t.ar || t.en || '—';
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async kpis() {
    const [
      projects,
      units,
      available,
      reserved,
      sold,
      leadsTotal,
      leadsNew,
      pendingVisits,
      contracts,
      revenue,
    ] = await this.prisma.$transaction([
      this.prisma.project.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.unit.count(),
      this.prisma.unit.count({ where: { status: UnitStatus.AVAILABLE } }),
      this.prisma.unit.count({ where: { status: UnitStatus.RESERVED } }),
      this.prisma.unit.count({ where: { status: UnitStatus.SOLD } }),
      this.prisma.lead.count(),
      this.prisma.lead.count({ where: { stage: 'NEW' } }),
      this.prisma.visitRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.contract.count(),
      this.prisma.deposit.aggregate({ _sum: { amount: true } }),
    ]);
    return {
      projects,
      units: { total: units, available, reserved, sold },
      leads: { total: leadsTotal, new: leadsNew },
      pendingVisits,
      contracts,
      depositsTotal: revenue._sum.amount ?? 0,
    };
  }

  async sales(period?: string, dateFrom?: string, dateTo?: string) {
    const companyId = getRequiredCompanyId();
    let where: Prisma.ContractWhereInput = {};
    const conditions: Prisma.Sql[] = [Prisma.sql`c."companyId" = ${companyId}`];
    if (dateFrom || dateTo) {
      where = {
        createdAt: {
          ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
          ...(dateTo ? { lte: new Date(dateTo) } : {}),
        },
      };
      if (dateFrom) conditions.push(Prisma.sql`c."createdAt" >= ${new Date(dateFrom)}`);
      if (dateTo)   conditions.push(Prisma.sql`c."createdAt" <= ${new Date(dateTo + 'T23:59:59.999Z')}`);
    } else if (period) {
      where = this.periodWhereContract(period);
      conditions.push(Prisma.sql`to_char(c."createdAt", 'YYYY-MM') = ${period}`);
    }
    const whereClause = conditions.length
      ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
      : Prisma.empty;
    const [count, totalAmount, byProject] = await this.prisma.$transaction([
      this.prisma.contract.count({ where }),
      this.prisma.contract.aggregate({ where, _sum: { totalAmount: true } }),
      this.prisma.$queryRaw<Array<{ projectId: string; total: number; count: number }>>(Prisma.sql`
        SELECT p.id as "projectId", COUNT(c.*)::int as count, COALESCE(SUM(c."totalAmount"), 0)::float as total
        FROM "Contract" c
        JOIN "Unit" u ON u.id = c."unitId"
        JOIN "Building" b ON b.id = u."buildingId"
        JOIN "Phase" ph ON ph.id = b."phaseId"
        JOIN "Project" p ON p.id = ph."projectId"
        ${whereClause}
        GROUP BY p.id
        ORDER BY total DESC
      `),
    ]);
    return {
      contracts: count,
      total: totalAmount._sum.totalAmount ?? 0,
      byProject,
    };
  }

  async financial(period?: string, dateFrom?: string, dateTo?: string) {
    let where: Prisma.DepositWhereInput = {};
    if (dateFrom || dateTo) {
      where = {
        paidAt: {
          ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
          ...(dateTo ? { lte: new Date(dateTo) } : {}),
        },
      };
    } else if (period) {
      where = this.periodWhereDeposit(period);
    }
    const [count, sum, verified] = await this.prisma.$transaction([
      this.prisma.deposit.count({ where }),
      this.prisma.deposit.aggregate({ where, _sum: { amount: true } }),
      this.prisma.deposit.count({ where: { ...where, verified: true } }),
    ]);
    return {
      deposits: count,
      verified,
      total: sum._sum.amount ?? 0,
    };
  }

  async reservations(dateFrom?: string, dateTo?: string) {
    const where: Prisma.ReservationWhereInput =
      dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {};
    const groups = await this.prisma.reservation.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });
    return groups.reduce<Record<string, number>>(
      (acc, g) => ((acc[g.status] = g._count._all), acc),
      {},
    );
  }

  async salesFunnel(dateFrom?: string, dateTo?: string) {
    const dateCond = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo) } : {}),
    };
    const hasDate = !!(dateFrom || dateTo);
    const dateWhere = hasDate ? { where: { createdAt: dateCond } } : undefined;
    const [leads, visits, reservations, contracts] = await this.prisma.$transaction([
      this.prisma.lead.count(dateWhere),
      this.prisma.visitRequest.count(dateWhere),
      this.prisma.reservation.count(dateWhere),
      this.prisma.contract.count(dateWhere),
    ]);
    return { leads, visits, reservations, contracts };
  }

  async brokerLeaderboard(dateFrom?: string, dateTo?: string) {
    const companyId = getRequiredCompanyId();
    const conditions: Prisma.Sql[] = [
      Prisma.sql`bc."companyId" = ${companyId}`,
      Prisma.sql`bc.status IN ('APPROVED', 'PAID')`,
    ];
    if (dateFrom) conditions.push(Prisma.sql`bc."earnedAt" >= ${new Date(dateFrom)}`);
    if (dateTo)   conditions.push(Prisma.sql`bc."earnedAt" <= ${new Date(dateTo + 'T23:59:59.999Z')}`);
    const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
    return this.prisma.$queryRaw<Array<{
      brokerId: string;
      brokerName: string;
      commissionAmount: number;
      count: number;
    }>>(Prisma.sql`
      SELECT
        u.id                                           AS "brokerId",
        u."fullName"                                   AS "brokerName",
        COALESCE(SUM(bc."netAmount"), 0)::float        AS "commissionAmount",
        COUNT(bc.id)::int                              AS count
      FROM "BrokerCommission" bc
      JOIN "User" u ON u.id = bc."brokerId"
      ${whereClause}
      GROUP BY u.id, u."fullName"
      ORDER BY "commissionAmount" DESC
      LIMIT 10
    `);
  }

  async salesTrend(year: number, projectId?: string) {
    const companyId = getRequiredCompanyId();
    const safeYear = Math.floor(year);
    const projectJoin = projectId
      ? Prisma.sql`JOIN "Unit" u ON u.id = c."unitId"
         JOIN "Building" b ON b.id = u."buildingId"
         JOIN "Phase" ph ON ph.id = b."phaseId"`
      : Prisma.empty;
    const projectFilter = projectId
      ? Prisma.sql`AND ph."projectId" = ${projectId}`
      : Prisma.empty;
    const rows = await this.prisma.$queryRaw<
      Array<{ month: number; contracts: number; total: number }>
    >(Prisma.sql`
       SELECT EXTRACT(MONTH FROM c."createdAt")::int AS month,
              COUNT(c.*)::int AS contracts,
              COALESCE(SUM(c."totalAmount"), 0)::float AS total
       FROM "Contract" c
       ${projectJoin}
       WHERE EXTRACT(YEAR FROM c."createdAt") = ${safeYear}
       AND c."companyId" = ${companyId}
       ${projectFilter}
       GROUP BY EXTRACT(MONTH FROM c."createdAt")
    `);
    const byMonth = new Map(rows.map((r) => [r.month, r]));
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const row = byMonth.get(m);
      return { month: m, label: AR_MONTHS[i], contracts: row?.contracts ?? 0, total: row?.total ?? 0 };
    });
  }

  // ── P14 — Admin dashboard summary ────────────────────────────────────────
  // One ADMIN-only call that backs the /dashboard home: live KPIs, the 6-month
  // reservation trend, lead-source distribution, a unified recent-activity
  // feed (derived from real createdAt rows), and actionable alert counts. Every
  // value is DB-derived — the dashboard renders empty/zero states rather than
  // any demo data when a section is empty.
  async adminSummary() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const expiringHorizon = new Date(now.getTime() +  7 * 24 * 60 * 60 * 1000);
    const prevMonthStart  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const in30            = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const in60            = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const in90            = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const [
      // ── original 11 operational counts ──
      projects,
      totalUnits,
      availableUnits,
      reservedUnits,
      newLeadsThisMonth,
      pendingDeposits,
      openMaintenance,
      contractsAwaitingSignature,
      reservationsExpiringSoon,
      visitsAwaitingConfirmation,
      infoRequestsOpen,
      // ── extended inventory / pipeline counts ──
      soldUnits,
      signedContracts,
      totalCustomers,
      totalTeam,
      // ── funnel counts (all-time pipeline volumes) ──
      funnelLeads,
      funnelVisits,
      funnelReservations,
      funnelContracts,
      // ── financial aggregates ──
      totalContractValueAgg,
      totalCollectedVerifiedAgg,
      overdueAgg,
      pendingBonusAgg,
      pendingPayoutsAgg,
      // ── MTD vs prior-month ──
      prevMonthCollectedAgg,
      collectedThisMonthAgg,
      prevMonthSignedContracts,
      signedContractsThisMonth,
      prevMonthNewLeads,
      // ── Cash flow forecast ──
      next30Agg,
      next3160Agg,
      next6190Agg,
    ] = await this.prisma.$transaction([
      // ── original 11 ──
      this.prisma.project.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.unit.count(),
      this.prisma.unit.count({ where: { status: UnitStatus.AVAILABLE } }),
      this.prisma.unit.count({ where: { status: UnitStatus.RESERVED } }),
      this.prisma.lead.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.deposit.count({ where: { reviewStatus: DepositReviewStatus.PENDING_REVIEW } }),
      this.prisma.maintenanceRequest.count({
        where: {
          status: {
            in: [MaintenanceStatus.OPEN, MaintenanceStatus.ASSIGNED, MaintenanceStatus.IN_PROGRESS],
          },
        },
      }),
      this.prisma.contract.count({ where: { signedAt: null } }),
      this.prisma.reservation.count({
        where: { status: ReservationStatus.PENDING, expiresAt: { gte: now, lte: expiringHorizon } },
      }),
      this.prisma.visitAppointment.count({ where: { status: AppointmentStatus.SCHEDULED } }),
      this.prisma.infoRequest.count({ where: { status: InfoRequestStatus.OPEN } }),
      // ── extended inventory / pipeline ──
      this.prisma.unit.count({ where: { status: UnitStatus.SOLD } }),
      this.prisma.contract.count({ where: { signedAt: { not: null } } }),
      this.prisma.user.count({ where: { role: UserRole.CUSTOMER } }),
      this.prisma.user.count({
        where: {
          role: {
            in: [
              UserRole.ADMIN,
              UserRole.SALES,
              UserRole.SALES_MANAGER,
              UserRole.MAINTENANCE_SUPERVISOR,
            ],
          },
        },
      }),
      // ── funnel all-time volumes ──
      this.prisma.lead.count(),
      this.prisma.visitRequest.count(),
      this.prisma.reservation.count(),
      this.prisma.contract.count({ where: { signedAt: { not: null } } }),
      // ── financial aggregates ──
      this.prisma.contract.aggregate({ _sum: { totalAmount: true } }),
      this.prisma.deposit.aggregate({ where: { verified: true }, _sum: { amount: true } }),
      this.prisma.installment.aggregate({
        where: { status: InstallmentStatus.OVERDUE },
        _sum: { amount: true },
      }),
      this.prisma.bonusEntry.aggregate({
        where: { status: BonusEntryStatus.PENDING },
        _sum: { amount: true },
      }),
      this.prisma.brokerPayout.aggregate({
        where: { status: { in: [BrokerPayoutStatus.DRAFT, BrokerPayoutStatus.APPROVED] } },
        _sum: { totalNet: true },
      }),
      // ── MTD vs prior-month ──
      this.prisma.deposit.aggregate({
        where: { verified: true, paidAt: { gte: prevMonthStart, lt: startOfMonth } },
        _sum: { amount: true },
      }),
      this.prisma.deposit.aggregate({
        where: { verified: true, paidAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      this.prisma.contract.count({ where: { signedAt: { gte: prevMonthStart, lt: startOfMonth } } }),
      this.prisma.contract.count({ where: { signedAt: { gte: startOfMonth } } }),
      this.prisma.lead.count({ where: { createdAt: { gte: prevMonthStart, lt: startOfMonth } } }),
      // ── Cash flow forecast (next 30 / 31-60 / 61-90 days) ──
      this.prisma.installment.aggregate({
        where: { status: InstallmentStatus.PENDING, dueDate: { gte: now, lte: in30 } },
        _sum: { amount: true },
      }),
      this.prisma.installment.aggregate({
        where: { status: InstallmentStatus.PENDING, dueDate: { gt: in30, lte: in60 } },
        _sum: { amount: true },
      }),
      this.prisma.installment.aggregate({
        where: { status: InstallmentStatus.PENDING, dueDate: { gt: in60, lte: in90 } },
        _sum: { amount: true },
      }),
    ]);

    const [reservationTrend, leadSources, recentActivity, topProjects] = await Promise.all([
      this.reservationTrend(now),
      this.leadSourceDistribution(),
      this.recentActivity(),
      this.topProjects(),
    ]);

    return {
      kpis: {
        projects,
        totalUnits,
        availableUnits,
        reservedUnits,
        soldUnits,
        newLeadsThisMonth,
        pendingDeposits,
        openMaintenance,
        signedContracts,
        totalCustomers,
        totalTeam,
      },
      funnel: {
        leads:        funnelLeads,
        visits:       funnelVisits,
        reservations: funnelReservations,
        contracts:    funnelContracts,
      },
      financial: {
        totalContractValue:       Number(totalContractValueAgg._sum.totalAmount     ?? 0),
        totalCollectedVerified:   Number(totalCollectedVerifiedAgg._sum.amount      ?? 0),
        overdueTotal:             Number(overdueAgg._sum.amount                     ?? 0),
        pendingBonus:             Number(pendingBonusAgg._sum.amount                ?? 0),
        pendingBrokerPayouts:     Number(pendingPayoutsAgg._sum.totalNet            ?? 0),
        collectedThisMonth:       Number(collectedThisMonthAgg._sum.amount          ?? 0),
        prevMonthCollected:       Number(prevMonthCollectedAgg._sum.amount          ?? 0),
        signedContractsThisMonth,
        prevMonthSignedContracts,
        prevMonthNewLeads,
      },
      cashflowForecast: {
        next30:   Number(next30Agg._sum.amount   ?? 0),
        next3160: Number(next3160Agg._sum.amount ?? 0),
        next6190: Number(next6190Agg._sum.amount ?? 0),
      },
      reservationTrend,
      leadSources,
      recentActivity,
      topProjects,
      alerts: {
        contractsAwaitingSignature,
        depositsPendingReview: pendingDeposits,
        openMaintenance,
        reservationsExpiringSoon,
        visitsAwaitingConfirmation,
        infoRequestsOpen,
      },
    };
  }

  /** Reservation counts grouped by calendar month for the last 6 months. */
  private async reservationTrend(
    now: Date,
  ): Promise<Array<{ month: string; label: string; value: number }>> {
    const slots = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      return {
        start,
        end,
        month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
        label: AR_MONTHS[start.getMonth()]!,
      };
    });
    const counts = await this.prisma.$transaction(
      slots.map((s) =>
        this.prisma.reservation.count({ where: { createdAt: { gte: s.start, lt: s.end } } }),
      ),
    );
    return slots.map((s, i) => ({ month: s.month, label: s.label, value: counts[i] ?? 0 }));
  }

  /** Lead counts grouped by source, with resolved Arabic/English source names. */
  private async leadSourceDistribution(): Promise<Array<{ source: string; count: number }>> {
    const groups = await this.prisma.lead.groupBy({ by: ['sourceId'], _count: { _all: true } });
    const ids = groups
      .map((g) => g.sourceId)
      .filter((x): x is string => typeof x === 'string');
    const sources = ids.length
      ? await this.prisma.leadSource.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
      : [];
    const nameById = new Map(sources.map((s) => [s.id, s.name]));
    return groups
      .map((g) => {
        const raw = (g.sourceId ? nameById.get(g.sourceId) : null) as
          | { ar?: string; en?: string }
          | null
          | undefined;
        const label = raw?.ar || raw?.en || (g.sourceId ? 'غير معروف' : 'غير محدد');
        return { source: label, count: g._count._all };
      })
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Unified recent-activity feed derived from real `createdAt` rows across the
   * core entities (no demo data). Each item carries a display name, an action
   * label, optional project/unit context, and the timestamp. Returns the 8 most
   * recent across all sources.
   */
  private async recentActivity(): Promise<
    Array<{ id: string; type: string; title: string; action: string; context: string | null; createdAt: Date }>
  > {
    const take = 5;
    const [leads, reservations, contracts, visits, maintenance, deposits, infos] = await Promise.all([
      this.prisma.lead.findMany({
        orderBy: { createdAt: 'desc' },
        take,
        select: { id: true, fullName: true, createdAt: true },
      }),
      this.prisma.reservation.findMany({
        orderBy: { createdAt: 'desc' },
        take,
        select: {
          id: true,
          reservationNumber: true,
          createdAt: true,
          unit: { select: { code: true } },
          client: { select: { fullName: true } },
          lead: { select: { fullName: true } },
        },
      }),
      this.prisma.contract.findMany({
        orderBy: { createdAt: 'desc' },
        take,
        select: {
          id: true,
          contractNumber: true,
          createdAt: true,
          customer: { select: { fullName: true } },
        },
      }),
      this.prisma.visitRequest.findMany({
        orderBy: { createdAt: 'desc' },
        take,
        select: {
          id: true,
          createdAt: true,
          customerName: true,
          user: { select: { fullName: true } },
          lead: { select: { fullName: true } },
        },
      }),
      this.prisma.maintenanceRequest.findMany({
        orderBy: { createdAt: 'desc' },
        take,
        select: { id: true, createdAt: true, unit: { select: { code: true } } },
      }),
      this.prisma.deposit.findMany({
        orderBy: { createdAt: 'desc' },
        take,
        select: {
          id: true,
          createdAt: true,
          contract: { select: { contractNumber: true, customer: { select: { fullName: true } } } },
        },
      }),
      this.prisma.infoRequest.findMany({
        orderBy: { createdAt: 'desc' },
        take,
        select: {
          id: true,
          createdAt: true,
          user: { select: { fullName: true } },
          lead: { select: { fullName: true } },
        },
      }),
    ]);

    const items: Array<{
      id: string;
      type: string;
      title: string;
      action: string;
      context: string | null;
      createdAt: Date;
    }> = [
      ...leads.map((l) => ({
        id: `lead:${l.id}`,
        type: 'lead',
        title: l.fullName,
        action: 'فرصة جديدة',
        context: null,
        createdAt: l.createdAt,
      })),
      ...reservations.map((r) => ({
        id: `reservation:${r.id}`,
        type: 'reservation',
        title: r.client?.fullName ?? r.lead?.fullName ?? 'عميل',
        action: 'حجز جديد',
        context: r.unit?.code ?? r.reservationNumber ?? null,
        createdAt: r.createdAt,
      })),
      ...contracts.map((c) => ({
        id: `contract:${c.id}`,
        type: 'contract',
        title: c.customer?.fullName ?? 'عميل',
        action: 'عقد جديد',
        context: c.contractNumber ?? null,
        createdAt: c.createdAt,
      })),
      ...visits.map((v) => ({
        id: `visit:${v.id}`,
        type: 'visit',
        title: v.user?.fullName ?? v.lead?.fullName ?? v.customerName ?? 'زائر',
        action: 'طلب زيارة',
        context: null,
        createdAt: v.createdAt,
      })),
      ...maintenance.map((m) => ({
        id: `maintenance:${m.id}`,
        type: 'maintenance',
        title: m.unit?.code ?? 'وحدة',
        action: 'طلب صيانة',
        context: m.unit?.code ?? null,
        createdAt: m.createdAt,
      })),
      ...deposits.map((d) => ({
        id: `deposit:${d.id}`,
        type: 'deposit',
        title: d.contract?.customer?.fullName ?? 'عميل',
        action: 'دفعة جديدة',
        context: d.contract?.contractNumber ?? null,
        createdAt: d.createdAt,
      })),
      ...infos.map((info) => ({
        id: `info:${info.id}`,
        type: 'info_request',
        title: info.user?.fullName ?? info.lead?.fullName ?? 'زائر',
        action: 'استفسار جديد',
        context: null,
        createdAt: info.createdAt,
      })),
    ];

    return items
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 8);
  }

  private async topProjects() {
    const projectsRaw = await this.prisma.project.findMany({
      where: { status: 'PUBLISHED' },
      select: {
        id: true,
        name: true,
        phases: {
          select: {
            buildings: {
              select: {
                units: {
                  select: {
                    status: true,
                    contracts: {
                      where: { signedAt: { not: null } },
                      select: { totalAmount: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return projectsRaw
      .map((p) => {
        const units = p.phases.flatMap((ph) =>
          ph.buildings.flatMap((b) => b.units),
        );
        const availableUnits = units.filter(
          (u) => u.status === UnitStatus.AVAILABLE,
        ).length;
        const reservedUnits = units.filter(
          (u) => u.status === UnitStatus.RESERVED,
        ).length;
        const soldUnits = units.filter(
          (u) => u.status === UnitStatus.SOLD,
        ).length;
        const contracts = units.flatMap((u) => u.contracts);
        const signedContracts = contracts.length;
        const contractValue = contracts.reduce(
          (s, c) => s + Number(c.totalAmount),
          0,
        );
        return {
          id: p.id,
          name: translatableAr(p.name),
          totalUnits: units.length,
          availableUnits,
          reservedUnits,
          soldUnits,
          signedContracts,
          contractValue,
        };
      })
      .sort(
        (a, b) =>
          b.signedContracts - a.signedContracts ||
          b.reservedUnits - a.reservedUnits,
      );
  }

  /**
   * P14.1 — admin dashboard summary as a downloadable CSV. Built from the SAME
   * real `adminSummary()` data (KPIs, reservation trend, lead sources, alerts,
   * recent activity) as stacked tables. No demo values.
   */
  async adminSummaryCsv(): Promise<string> {
    const s = await this.adminSummary();

    const kpiRows: CsvCell[][] = [
      ['المشاريع المنشورة', s.kpis.projects],
      ['إجمالي الوحدات', s.kpis.totalUnits],
      ['وحدات متاحة', s.kpis.availableUnits],
      ['وحدات محجوزة', s.kpis.reservedUnits],
      ['فرص جديدة هذا الشهر', s.kpis.newLeadsThisMonth],
      ['ودائع بانتظار المراجعة', s.kpis.pendingDeposits],
      ['طلبات صيانة مفتوحة', s.kpis.openMaintenance],
    ];
    const trendRows: CsvCell[][] = s.reservationTrend.map((t) => [t.month, t.label, t.value]);
    const leadRows: CsvCell[][] = s.leadSources.map((l) => [l.source, l.count]);
    const alertRows: CsvCell[][] = [
      ['عقود بانتظار التوقيع', s.alerts.contractsAwaitingSignature],
      ['دفعات بانتظار المراجعة', s.alerts.depositsPendingReview],
      ['طلبات صيانة مفتوحة', s.alerts.openMaintenance],
      ['حجوزات تنتهي قريباً', s.alerts.reservationsExpiringSoon],
      ['زيارات بانتظار تأكيد العميل', s.alerts.visitsAwaitingConfirmation],
      ['استفسارات مفتوحة', s.alerts.infoRequestsOpen],
    ];
    const activityRows: CsvCell[][] = s.recentActivity.map((a) => [
      a.action,
      a.title,
      a.context ?? '',
      a.createdAt.toISOString(),
    ]);

    return [
      'المؤشرات الرئيسية',
      toCsv(['المؤشر', 'القيمة'], kpiRows),
      '',
      'اتجاه الحجوزات (آخر 6 أشهر)',
      toCsv(['الشهر', 'التسمية', 'عدد الحجوزات'], trendRows),
      '',
      'توزيع مصادر العملاء المحتملين',
      toCsv(['المصدر', 'العدد'], leadRows),
      '',
      'التنبيهات المعلقة',
      toCsv(['التنبيه', 'العدد'], alertRows),
      '',
      'آخر النشاطات',
      toCsv(['النشاط', 'الجهة', 'السياق', 'التاريخ'], activityRows),
    ].join('\r\n');
  }

  /**
   * P14.2 + P15.4 — admin dashboard summary as a board-style Arabic XLSX: a
   * branded cover (executive summary + real-alert insights + a reservation-trend
   * bar chart and a lead-source doughnut) plus four detail sheets. Built from the
   * SAME real `adminSummary()` data; no demo values. Charts degrade gracefully —
   * if rendering returns null the tables still ship and the file is never broken.
   */
  async adminSummaryXlsx(): Promise<Buffer> {
    const s = await this.adminSummary();
    const wb = createReportWorkbook();

    // Real, non-zero alerts only — reused on the cover + the detail sheet.
    const alertRows = (
      [
        ['عقود بانتظار التوقيع', s.alerts.contractsAwaitingSignature],
        ['دفعات بانتظار المراجعة', s.alerts.depositsPendingReview],
        ['طلبات صيانة مفتوحة', s.alerts.openMaintenance],
        ['حجوزات تنتهي قريباً', s.alerts.reservationsExpiringSoon],
        ['زيارات بانتظار تأكيد العميل', s.alerts.visitsAwaitingConfirmation],
        ['استفسارات مفتوحة', s.alerts.infoRequestsOpen],
      ] as Array<[string, number]>
    ).filter(([, count]) => count > 0);

    // Charts up-front (null on any rendering failure → graceful fallback).
    const trendChart = await renderBarChartPng({
      title: 'اتجاه الحجوزات (آخر 6 أشهر)',
      series: s.reservationTrend.map((t) => ({ label: t.label, value: t.value })),
    });
    const sourcesChart = await renderDoughnutChartPng({
      title: 'توزيع مصادر العملاء',
      series: s.leadSources.map((l) => ({ label: l.source, value: l.count })),
    });

    // ── Sheet 1: الملخص — polished board cover (P15.4.1) ────────────────────
    const SPAN = 6;
    const sum = wb.addWorksheet('الملخص');
    setupBoardSheet(sum, { widths: [16, 16, 16, 16, 16, 16], landscape: true });
    addBoardBanner(sum, 'تقرير لوحة التحكم', SPAN, { wb, logo: brandLogoPng() });

    addSectionTitle(sum, 'الملخص التنفيذي', SPAN);
    addKpiCards(
      sum,
      [
        { label: 'المشاريع المنشورة', value: s.kpis.projects },
        { label: 'إجمالي الوحدات', value: s.kpis.totalUnits },
        { label: 'وحدات متاحة', value: s.kpis.availableUnits },
        { label: 'وحدات محجوزة', value: s.kpis.reservedUnits },
        { label: 'فرص جديدة هذا الشهر', value: s.kpis.newLeadsThisMonth },
        { label: 'دفعات بانتظار المراجعة', value: s.kpis.pendingDeposits },
        { label: 'طلبات صيانة مفتوحة', value: s.kpis.openMaintenance },
      ],
      { span: SPAN, perRow: 3 },
    );

    addSectionTitle(sum, 'التنبيهات والمخاطر', SPAN);
    addKpiCards(
      sum,
      alertRows.map(([label, value]) => ({ label, value })),
      { span: SPAN, perRow: 3, bg: XLSX_ALERT_BG },
    );

    addChartBlock(wb, sum, 'اتجاه الحجوزات (آخر 6 أشهر)', trendChart, { span: SPAN, width: 720, height: 300 });
    addChartBlock(wb, sum, 'توزيع مصادر العملاء', sourcesChart, { span: SPAN, width: 560, height: 300 });

    addFooter(sum);

    // ── Sheet 2: اتجاهات الحجوزات ───────────────────────────────────────────
    const trend = wb.addWorksheet('اتجاهات الحجوزات');
    addTable(
      trend,
      ['الشهر', 'الشهر (بالعربية)', 'عدد الحجوزات'],
      s.reservationTrend.map((t) => [t.month, t.label, t.value]),
      [14, 20, 16],
    );
    const trendTotal = s.reservationTrend.reduce((acc, t) => acc + t.value, 0);
    styleTotalsRow(trend.addRow(['الإجمالي', '', trendTotal]));

    // ── Sheet 3: مصادر العملاء ──────────────────────────────────────────────
    const lead = wb.addWorksheet('مصادر العملاء');
    const leadTotal = s.leadSources.reduce((acc, l) => acc + l.count, 0);
    addTable(
      lead,
      ['المصدر', 'العدد', 'النسبة'],
      s.leadSources.map((l) => [
        l.source,
        l.count,
        leadTotal > 0 ? `${Math.round((l.count / leadTotal) * 100)}%` : '0%',
      ]),
      [26, 14, 12],
    );

    // ── Sheet 4: التنبيهات (real, non-zero alerts only — reuses the cover set) ─
    const alertSheet = wb.addWorksheet('التنبيهات');
    addTable(alertSheet, ['التنبيه', 'العدد'], alertRows, [34, 14]);

    // ── Sheet 5: آخر النشاطات ───────────────────────────────────────────────
    const activity = wb.addWorksheet('آخر النشاطات');
    addTable(
      activity,
      ['النشاط', 'الجهة', 'السياق', 'التاريخ'],
      s.recentActivity.map((a) => [a.action, a.title, a.context ?? '—', a.createdAt]),
      [18, 24, 16, 20],
    );
    activity.getColumn(4).numFmt = 'yyyy-mm-dd hh:mm';

    return workbookToBuffer(wb);
  }

  async financialDashboard(opts: {
    projectId?: string;
    q?: string;
    type?: DepositType;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const now = new Date();
    const todayUTC = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const monthEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );
    const weekEnd = new Date(
      todayUTC.getTime() + 7 * 24 * 60 * 60 * 1000,
    );
    const in30 = new Date(todayUTC.getTime() + 30 * 24 * 60 * 60 * 1000);
    const in60 = new Date(todayUTC.getTime() + 60 * 24 * 60 * 60 * 1000);
    const in90 = new Date(todayUTC.getTime() + 90 * 24 * 60 * 60 * 1000);

    // ── Installment filter blocks ──────────────────────────────────────────
    const instAnd: Prisma.InstallmentWhereInput[] = [];
    if (opts.projectId) {
      instAnd.push({
        plan: {
          contract: {
            unit: { building: { phase: { projectId: opts.projectId } } },
          },
        },
      });
    }
    if (opts.q) {
      instAnd.push({
        plan: {
          contract: {
            customer: {
              fullName: {
                contains: opts.q,
                mode: Prisma.QueryMode.insensitive,
              },
            },
          },
        },
      });
    }

    // ── Deposit filter blocks ──────────────────────────────────────────────
    // base: projectId + q + type (no date — used for fixed-period "this month" KPI)
    const baseDepAnd: Prisma.DepositWhereInput[] = [];
    if (opts.projectId) {
      baseDepAnd.push({
        OR: [
          {
            contract: {
              unit: { building: { phase: { projectId: opts.projectId } } },
            },
          },
          {
            reservation: {
              unit: { building: { phase: { projectId: opts.projectId } } },
            },
          },
        ],
      });
    }
    if (opts.q) {
      baseDepAnd.push({
        OR: [
          {
            contract: {
              customer: {
                fullName: {
                  contains: opts.q,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            },
          },
          {
            reservation: {
              client: {
                fullName: {
                  contains: opts.q,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            },
          },
          {
            reservation: {
              lead: {
                fullName: {
                  contains: opts.q,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            },
          },
        ],
      });
    }
    if (opts.type) baseDepAnd.push({ type: opts.type });

    // filtered: base + optional date range (used for totalCollected, depositCount, recentDeposits)
    const filteredDepAnd: Prisma.DepositWhereInput[] = [...baseDepAnd];
    if (opts.dateFrom || opts.dateTo) {
      filteredDepAnd.push({
        paidAt: {
          ...(opts.dateFrom ? { gte: new Date(opts.dateFrom) } : {}),
          ...(opts.dateTo ? { lte: new Date(opts.dateTo) } : {}),
        },
      });
    }

    // ── Contract filter blocks ─────────────────────────────────────────────
    const contractAnd: Prisma.ContractWhereInput[] = [];
    if (opts.projectId) {
      contractAnd.push({
        unit: { building: { phase: { projectId: opts.projectId } } },
      });
    }
    if (opts.q) {
      contractAnd.push({
        customer: {
          fullName: {
            contains: opts.q,
            mode: Prisma.QueryMode.insensitive,
          },
        },
      });
    }

    // ── Helper factories ──────────────────────────────────────────────────
    const instWhere = (
      extra: Prisma.InstallmentWhereInput,
    ): Prisma.InstallmentWhereInput => ({ AND: [...instAnd, extra] });

    const baseDepWhere = (
      extra?: Prisma.DepositWhereInput,
    ): Prisma.DepositWhereInput =>
      baseDepAnd.length === 0 && !extra
        ? {}
        : { AND: [...baseDepAnd, ...(extra ? [extra] : [])] };

    const filteredDepWhere = (
      extra?: Prisma.DepositWhereInput,
    ): Prisma.DepositWhereInput =>
      filteredDepAnd.length === 0 && !extra
        ? {}
        : { AND: [...filteredDepAnd, ...(extra ? [extra] : [])] };

    const contractWhere: Prisma.ContractWhereInput =
      contractAnd.length > 0 ? { AND: contractAnd } : {};

    // ── Shared installment select for tables ───────────────────────────────
    const instSelect = {
      id: true,
      type: true,
      dueDate: true,
      amount: true,
      status: true,
      plan: {
        select: {
          contract: {
            select: {
              id: true,
              contractNumber: true,
              customer: { select: { id: true, fullName: true } },
              unit: { select: { id: true, code: true } },
            },
          },
        },
      },
    } as const;

    // ── Run all 13 queries in parallel ────────────────────────────────────
    const [
      totalContractAgg,
      totalCollectedAgg,
      totalRemainingAgg,
      totalOverdueAgg,
      collectedThisMonthAgg,
      dueThisMonthAgg,
      contractCount,
      depositCount,
      overdueCount,
      overdueRows,
      upcomingWeekRows,
      upcomingMonthRows,
      recentDeposits,
      forecast30Agg,
      forecast3160Agg,
      forecast6190Agg,
    ] = await Promise.all([
      // ── KPI aggregates ──
      this.prisma.contract.aggregate({
        where: contractWhere,
        _sum: { totalAmount: true },
      }),
      this.prisma.deposit.aggregate({
        where: filteredDepWhere(),
        _sum: { amount: true },
      }),
      this.prisma.installment.aggregate({
        where: instWhere({
          status: { in: [InstallmentStatus.PENDING, InstallmentStatus.OVERDUE] },
        }),
        _sum: { amount: true },
      }),
      this.prisma.installment.aggregate({
        where: instWhere({ status: InstallmentStatus.OVERDUE }),
        _sum: { amount: true },
      }),
      // collectedThisMonth uses baseDepWhere (ignores user date range — always current month)
      this.prisma.deposit.aggregate({
        where: baseDepWhere({ paidAt: { gte: monthStart, lt: monthEnd } }),
        _sum: { amount: true },
      }),
      this.prisma.installment.aggregate({
        where: instWhere({
          dueDate: { gte: monthStart, lt: monthEnd },
          status: { in: [InstallmentStatus.PENDING, InstallmentStatus.OVERDUE] },
        }),
        _sum: { amount: true },
      }),
      // ── KPI counts ──
      this.prisma.contract.count({ where: contractWhere }),
      this.prisma.deposit.count({ where: filteredDepWhere() }),
      this.prisma.installment.count({
        where: instWhere({ status: InstallmentStatus.OVERDUE }),
      }),
      // ── Overdue table ──
      this.prisma.installment.findMany({
        where: instWhere({ status: InstallmentStatus.OVERDUE }),
        select: instSelect,
        orderBy: { dueDate: 'asc' },
        take: 50,
      }),
      // ── Upcoming this week: [today, today+7) PENDING ──
      this.prisma.installment.findMany({
        where: instWhere({
          status: InstallmentStatus.PENDING,
          dueDate: { gte: todayUTC, lt: weekEnd },
        }),
        select: instSelect,
        orderBy: { dueDate: 'asc' },
        take: 20,
      }),
      // ── Upcoming rest of month: [today+7, monthEnd) PENDING ──
      this.prisma.installment.findMany({
        where: instWhere({
          status: InstallmentStatus.PENDING,
          dueDate: { gte: weekEnd, lt: monthEnd },
        }),
        select: instSelect,
        orderBy: { dueDate: 'asc' },
        take: 20,
      }),
      // ── Recent deposits ──
      this.prisma.deposit.findMany({
        where: filteredDepWhere(),
        orderBy: { paidAt: 'desc' },
        take: 10,
        select: {
          id: true,
          type: true,
          amount: true,
          paidAt: true,
          verified: true,
          contract: {
            select: {
              id: true,
              contractNumber: true,
              customer: { select: { id: true, fullName: true } },
              unit: { select: { id: true, code: true } },
            },
          },
          reservation: {
            select: {
              id: true,
              reservationNumber: true,
              unit: { select: { id: true, code: true } },
              client: { select: { id: true, fullName: true } },
              lead: { select: { id: true, fullName: true } },
            },
          },
        },
      }),
      // ── 30/60/90-day cashflow forecast ──
      this.prisma.installment.aggregate({
        where: instWhere({ status: InstallmentStatus.PENDING, dueDate: { gte: todayUTC, lte: in30 } }),
        _sum: { amount: true },
      }),
      this.prisma.installment.aggregate({
        where: instWhere({ status: InstallmentStatus.PENDING, dueDate: { gt: in30, lte: in60 } }),
        _sum: { amount: true },
      }),
      this.prisma.installment.aggregate({
        where: instWhere({ status: InstallmentStatus.PENDING, dueDate: { gt: in60, lte: in90 } }),
        _sum: { amount: true },
      }),
    ]);

    const zero = new Prisma.Decimal(0);

    // ── F1: collection correctness, computed receivables, aging, booking ──────
    // Aging thresholds, date-level relative to todayUTC. A due-today installment
    // is NOT overdue (dueDate < todayUTC is required); it falls under due-soon.
    const d30 = new Date(todayUTC.getTime() - 30 * 86_400_000);
    const d60 = new Date(todayUTC.getTime() - 60 * 86_400_000);
    const d90 = new Date(todayUTC.getTime() - 90 * 86_400_000);

    // Booking-specific deposit filter: projectId + q + date (NOT the user
    // `type`), scoped to BOOKING_AMOUNT. Built independently to avoid the
    // user-type filter that baseDepAnd may carry.
    const bookingDepAnd: Prisma.DepositWhereInput[] = [];
    if (opts.projectId) {
      bookingDepAnd.push({
        OR: [
          { contract: { unit: { building: { phase: { projectId: opts.projectId } } } } },
          { reservation: { unit: { building: { phase: { projectId: opts.projectId } } } } },
        ],
      });
    }
    if (opts.q) {
      bookingDepAnd.push({
        OR: [
          { contract: { customer: { fullName: { contains: opts.q, mode: Prisma.QueryMode.insensitive } } } },
          { reservation: { client: { fullName: { contains: opts.q, mode: Prisma.QueryMode.insensitive } } } },
          { reservation: { lead: { fullName: { contains: opts.q, mode: Prisma.QueryMode.insensitive } } } },
        ],
      });
    }
    if (opts.dateFrom || opts.dateTo) {
      bookingDepAnd.push({
        paidAt: {
          ...(opts.dateFrom ? { gte: new Date(opts.dateFrom) } : {}),
          ...(opts.dateTo ? { lte: new Date(opts.dateTo) } : {}),
        },
      });
    }
    bookingDepAnd.push({ type: DepositType.BOOKING_AMOUNT });
    const bookingDepWhere = (extra?: Prisma.DepositWhereInput): Prisma.DepositWhereInput => ({
      AND: [...bookingDepAnd, ...(extra ? [extra] : [])],
    });

    // Reservation pipeline filter (projectId only; q/date not applied here —
    // see Batch F1 report §8 limitations).
    const resvWhere = (status: ReservationStatus): Prisma.ReservationWhereInput => ({
      status,
      ...(opts.projectId
        ? { unit: { building: { phase: { projectId: opts.projectId } } } }
        : {}),
    });

    // Unpaid = anything not PAID (covers PENDING + OVERDUE without trusting the
    // possibly-stale stored OVERDUE flag).
    const unpaid = { status: { not: InstallmentStatus.PAID } } as const;
    const agingWhere = (range: Prisma.DateTimeFilter<'Installment'>): Prisma.InstallmentWhereInput =>
      instWhere({ ...unpaid, dueDate: range });

    const [
      collectedVerifiedAgg,
      byTypeGroups,
      outstandingAgg,
      dueSoonAgg,
      overdueComputedAgg,
      aging1Agg,
      aging2Agg,
      aging3Agg,
      aging4Agg,
      pendingResvCount,
      approvedResvCount,
      pendingResvAgg,
      approvedResvAgg,
      bookingCollectedVerifiedAgg,
      bookingCollectedAllAgg,
    ] = await Promise.all([
      this.prisma.deposit.aggregate({ where: filteredDepWhere({ verified: true }), _sum: { amount: true } }),
      this.prisma.deposit.groupBy({
        by: ['type', 'verified'],
        where: filteredDepWhere(),
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.installment.aggregate({ where: instWhere(unpaid), _sum: { amount: true } }),
      this.prisma.installment.aggregate({
        where: instWhere({ ...unpaid, dueDate: { gte: todayUTC, lt: weekEnd } }),
        _sum: { amount: true },
      }),
      this.prisma.installment.aggregate({
        where: instWhere({ ...unpaid, dueDate: { lt: todayUTC } }),
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.installment.aggregate({ where: agingWhere({ gte: d30, lt: todayUTC }), _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.installment.aggregate({ where: agingWhere({ gte: d60, lt: d30 }), _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.installment.aggregate({ where: agingWhere({ gte: d90, lt: d60 }), _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.installment.aggregate({ where: agingWhere({ lt: d90 }), _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.reservation.count({ where: resvWhere(ReservationStatus.PENDING) }),
      this.prisma.reservation.count({ where: resvWhere(ReservationStatus.APPROVED) }),
      this.prisma.reservation.aggregate({ where: resvWhere(ReservationStatus.PENDING), _sum: { bookingAmount: true } }),
      this.prisma.reservation.aggregate({ where: resvWhere(ReservationStatus.APPROVED), _sum: { bookingAmount: true } }),
      this.prisma.deposit.aggregate({ where: bookingDepWhere({ verified: true }), _sum: { amount: true } }),
      this.prisma.deposit.aggregate({ where: bookingDepWhere(), _sum: { amount: true } }),
    ]);

    // Decimal-safe coercion for money arithmetic (aggregates are Decimal in
    // prod; this also tolerates number/string inputs).
    const D = (v: Prisma.Decimal | number | string | null | undefined) =>
      new Prisma.Decimal(v ?? 0);

    // Collection: verified-only is the bankable headline; all/unverified kept too.
    const collectedAll = D(totalCollectedAgg._sum.amount);
    const collectedVerified = D(collectedVerifiedAgg._sum.amount);
    const collectedUnverified = collectedAll.minus(collectedVerified);

    // Per-DepositType breakdown (respects active filters, incl. the user type
    // filter if set), split into verified/unverified.
    type TypeAcc = { count: number; all: Prisma.Decimal; verified: Prisma.Decimal; unverified: Prisma.Decimal };
    const byType = new Map<DepositType, TypeAcc>();
    for (const t of Object.values(DepositType)) {
      byType.set(t, { count: 0, all: zero, verified: zero, unverified: zero });
    }
    for (const g of byTypeGroups) {
      const acc = byType.get(g.type);
      if (!acc) continue;
      const amt = D(g._sum.amount);
      acc.count += g._count?._all ?? 0;
      acc.all = acc.all.plus(amt);
      if (g.verified) acc.verified = acc.verified.plus(amt);
      else acc.unverified = acc.unverified.plus(amt);
    }
    const collectionByType = Object.values(DepositType).map((t) => {
      const acc = byType.get(t)!;
      return {
        type: t,
        count: acc.count,
        totalAll: acc.all.toString(),
        totalVerified: acc.verified.toString(),
        totalUnverified: acc.unverified.toString(),
      };
    });

    const agingBucket = (
      agg: { _sum: { amount: Prisma.Decimal | null }; _count?: { _all: number } },
      label: string,
    ) => ({ label, count: agg._count?._all ?? 0, amount: (agg._sum.amount ?? zero).toString() });
    const aging = [
      agingBucket(aging1Agg, '1-30'),
      agingBucket(aging2Agg, '31-60'),
      agingBucket(aging3Agg, '61-90'),
      agingBucket(aging4Agg, '90+'),
    ];

    // Booking pipeline (active reservations only; never treated as revenue).
    const pendingBooking = D(pendingResvAgg._sum.bookingAmount);
    const approvedBooking = D(approvedResvAgg._sum.bookingAmount);
    const bookingCollectedVerified = D(bookingCollectedVerifiedAgg._sum.amount);
    const bookingCollectedAll = D(bookingCollectedAllAgg._sum.amount);
    const uncollectedRaw = pendingBooking.plus(approvedBooking).minus(bookingCollectedVerified);
    const bookingUncollectedEstimate = uncollectedRaw.lessThan(0) ? zero : uncollectedRaw;
    const booking = {
      pendingReservationsCount: pendingResvCount,
      approvedReservationsCount: approvedResvCount,
      pendingReservationsBookingAmount: pendingBooking.toString(),
      approvedReservationsBookingAmount: approvedBooking.toString(),
      bookingCollectedVerified: bookingCollectedVerified.toString(),
      bookingCollectedAll: bookingCollectedAll.toString(),
      bookingUncollectedEstimate: bookingUncollectedEstimate.toString(),
    };

    // ── F4: commissions & liabilities (what the company owes) ─────────────────
    // Date range applied to: BonusEntry.createdAt, BrokerCommission.earnedAt,
    // BrokerPayout.createdAt. projectId applies to BrokerCommission only (it has
    // a projectId column); BonusEntry/BrokerPayout have no safe project relation
    // — see Batch F4 report §4.
    const dateRange = (field: 'createdAt' | 'earnedAt') =>
      opts.dateFrom || opts.dateTo
        ? {
            [field]: {
              ...(opts.dateFrom ? { gte: new Date(opts.dateFrom) } : {}),
              ...(opts.dateTo ? { lte: new Date(opts.dateTo) } : {}),
            },
          }
        : {};

    const bonusWhere = (status: BonusEntryStatus): Prisma.BonusEntryWhereInput => ({
      status,
      ...dateRange('createdAt'),
    });
    const bcBase: Prisma.BrokerCommissionWhereInput = {
      ...(opts.projectId ? { projectId: opts.projectId } : {}),
      ...dateRange('earnedAt'),
    };
    const bcWhere = (extra: Prisma.BrokerCommissionWhereInput): Prisma.BrokerCommissionWhereInput => ({
      AND: [bcBase, extra],
    });
    // "Unpaid" broker commission = APPROVED and not settled through a PAID payout.
    const bcUnpaidStatus: Prisma.BrokerCommissionWhereInput = {
      status: BrokerCommissionStatus.APPROVED,
      OR: [{ payoutId: null }, { payout: { status: { not: BrokerPayoutStatus.PAID } } }],
    };
    const bcPaidStatus: Prisma.BrokerCommissionWhereInput = {
      status: BrokerCommissionStatus.APPROVED,
      payout: { status: BrokerPayoutStatus.PAID },
    };

    const [
      bonusPendingAgg,
      bonusApprovedAgg,
      bonusPaidAgg,
      bcPendingAgg,
      bcApprovedAgg,
      bcPaidAgg,
      bcUnpaidAgg,
      payoutGroups,
    ] = await Promise.all([
      this.prisma.bonusEntry.aggregate({ where: bonusWhere(BonusEntryStatus.PENDING), _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.bonusEntry.aggregate({ where: bonusWhere(BonusEntryStatus.APPROVED), _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.bonusEntry.aggregate({ where: bonusWhere(BonusEntryStatus.PAID), _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.brokerCommission.aggregate({ where: bcWhere({ status: BrokerCommissionStatus.PENDING }), _sum: { netAmount: true }, _count: { _all: true } }),
      this.prisma.brokerCommission.aggregate({ where: bcWhere({ status: BrokerCommissionStatus.APPROVED }), _sum: { netAmount: true }, _count: { _all: true } }),
      this.prisma.brokerCommission.aggregate({ where: bcWhere(bcPaidStatus), _sum: { netAmount: true }, _count: { _all: true } }),
      this.prisma.brokerCommission.aggregate({ where: bcWhere(bcUnpaidStatus), _sum: { netAmount: true }, _count: { _all: true } }),
      this.prisma.brokerPayout.groupBy({
        by: ['status'],
        where: dateRange('createdAt'),
        _sum: { totalNet: true },
        _count: { _all: true },
      }),
    ]);

    const bonusPendingAmt = D(bonusPendingAgg._sum.amount);
    const bonusApprovedAmt = D(bonusApprovedAgg._sum.amount);
    const bonusUnpaidAmt = bonusPendingAmt.plus(bonusApprovedAmt);
    const bonusUnpaidCount = (bonusPendingAgg._count?._all ?? 0) + (bonusApprovedAgg._count?._all ?? 0);
    const bcUnpaidAmt = D(bcUnpaidAgg._sum.netAmount);

    const payoutByStatus = new Map<BrokerPayoutStatus, { amount: Prisma.Decimal; count: number }>();
    for (const st of Object.values(BrokerPayoutStatus)) payoutByStatus.set(st, { amount: zero, count: 0 });
    for (const g of payoutGroups) {
      payoutByStatus.set(g.status, { amount: D(g._sum.totalNet), count: g._count?._all ?? 0 });
    }
    const payoutAmt = (st: BrokerPayoutStatus) => payoutByStatus.get(st)!.amount.toString();
    const payoutCnt = (st: BrokerPayoutStatus) => payoutByStatus.get(st)!.count;

    const liabilities = {
      salesBonus: {
        pendingAmount: bonusPendingAmt.toString(),
        approvedAmount: bonusApprovedAmt.toString(),
        paidAmount: D(bonusPaidAgg._sum.amount).toString(),
        unpaidAmount: bonusUnpaidAmt.toString(),
        pendingCount: bonusPendingAgg._count?._all ?? 0,
        approvedCount: bonusApprovedAgg._count?._all ?? 0,
        paidCount: bonusPaidAgg._count?._all ?? 0,
        unpaidCount: bonusUnpaidCount,
      },
      brokerCommissions: {
        pendingAmount: D(bcPendingAgg._sum.netAmount).toString(),
        approvedAmount: D(bcApprovedAgg._sum.netAmount).toString(),
        // Approved commissions settled via a PAID payout.
        paidAmount: D(bcPaidAgg._sum.netAmount).toString(),
        // Approved & not settled through a PAID payout — the firm liability.
        unpaidAmount: bcUnpaidAmt.toString(),
        pendingCount: bcPendingAgg._count?._all ?? 0,
        approvedCount: bcApprovedAgg._count?._all ?? 0,
        paidCount: bcPaidAgg._count?._all ?? 0,
        unpaidCount: bcUnpaidAgg._count?._all ?? 0,
      },
      brokerPayouts: {
        draftAmount: payoutAmt(BrokerPayoutStatus.DRAFT),
        approvedAmount: payoutAmt(BrokerPayoutStatus.APPROVED),
        processingAmount: payoutAmt(BrokerPayoutStatus.PROCESSING),
        paidAmount: payoutAmt(BrokerPayoutStatus.PAID),
        draftCount: payoutCnt(BrokerPayoutStatus.DRAFT),
        approvedCount: payoutCnt(BrokerPayoutStatus.APPROVED),
        processingCount: payoutCnt(BrokerPayoutStatus.PROCESSING),
        paidCount: payoutCnt(BrokerPayoutStatus.PAID),
      },
      // No double-count: payout totals are NOT added here — they represent the
      // same broker commissions already captured in brokerCommissions.unpaid.
      totalUnpaidLiabilities: bonusUnpaidAmt.plus(bcUnpaidAmt).toString(),
    };

    // ── F5: documents / receipts health ───────────────────────────────────────
    // Document is polymorphic (ownerId is a bare UUID string, no FK relation),
    // so we fetch the owner-ids that DO have a receipt/contract document, then
    // exclude them via `notIn`. Existence is owner+category based — same-fileUrl
    // matching is NOT enforced (see Batch F5 report §2/§9 limitation).
    const [depReceiptDocs, contractDocs] = await Promise.all([
      this.prisma.document.findMany({
        where: { ownerType: DocumentOwnerType.DEPOSIT, category: DocumentCategory.RECEIPT, deletedAt: null },
        select: { ownerId: true },
        distinct: ['ownerId'],
      }),
      this.prisma.document.findMany({
        where: { ownerType: DocumentOwnerType.CONTRACT, category: DocumentCategory.CONTRACT, deletedAt: null },
        select: { ownerId: true },
        distinct: ['ownerId'],
      }),
    ]);
    const depDocOwnerIds = depReceiptDocs.map((d) => d.ownerId);
    const contractDocOwnerIds = contractDocs.map((d) => d.ownerId);

    // Contract filter blocks reuse the projectId/q `contractAnd`; signed-doc uses
    // a signedAt range (date filter), legacy-pdf uses createdAt.
    const contractDocWhere = (extra: Prisma.ContractWhereInput): Prisma.ContractWhereInput => ({
      AND: [...contractAnd, extra],
    });
    const signedAtFilter: Prisma.DateTimeNullableFilter<'Contract'> = {
      not: null,
      ...(opts.dateFrom ? { gte: new Date(opts.dateFrom) } : {}),
      ...(opts.dateTo ? { lte: new Date(opts.dateTo) } : {}),
    };

    const [
      depMissingReceiptAgg,
      verifiedNoDocAgg,
      legacyDepAgg,
      signedNoDocAgg,
      legacyContractAgg,
    ] = await Promise.all([
      // A. verified, no receiptUrl, and no RECEIPT document.
      this.prisma.deposit.aggregate({
        where: filteredDepWhere({
          verified: true,
          id: { notIn: depDocOwnerIds },
          OR: [{ receiptUrl: null }, { receiptUrl: '' }],
        }),
        _sum: { amount: true },
        _count: { _all: true },
      }),
      // B. verified, no RECEIPT document (regardless of receiptUrl).
      this.prisma.deposit.aggregate({
        where: filteredDepWhere({ verified: true, id: { notIn: depDocOwnerIds } }),
        _sum: { amount: true },
        _count: { _all: true },
      }),
      // C. legacy receiptUrl present but no RECEIPT document linked.
      this.prisma.deposit.aggregate({
        where: filteredDepWhere({ receiptUrl: { not: null }, id: { notIn: depDocOwnerIds } }),
        _sum: { amount: true },
        _count: { _all: true },
      }),
      // D. signed contract with no CONTRACT document.
      this.prisma.contract.aggregate({
        where: contractDocWhere({ signedAt: signedAtFilter, id: { notIn: contractDocOwnerIds } }),
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      // E. legacy pdfUrl present but no CONTRACT document linked.
      this.prisma.contract.aggregate({
        where: contractDocWhere({
          pdfUrl: { not: null },
          ...(opts.dateFrom || opts.dateTo
            ? {
                createdAt: {
                  ...(opts.dateFrom ? { gte: new Date(opts.dateFrom) } : {}),
                  ...(opts.dateTo ? { lte: new Date(opts.dateTo) } : {}),
                },
              }
            : {}),
          id: { notIn: contractDocOwnerIds },
        }),
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
    ]);

    const healthEntry = (
      agg: { _sum: { amount?: Prisma.Decimal | null; totalAmount?: Prisma.Decimal | null }; _count?: { _all: number } },
      field: 'amount' | 'totalAmount',
    ) => ({ count: agg._count?._all ?? 0, amount: D(agg._sum[field]).toString() });

    const documentsHealth = {
      depositsMissingReceipt: healthEntry(depMissingReceiptAgg, 'amount'),
      verifiedDepositsMissingReceiptDocument: healthEntry(verifiedNoDocAgg, 'amount'),
      depositsWithLegacyReceiptUrlMissingDocument: healthEntry(legacyDepAgg, 'amount'),
      signedContractsMissingDocument: healthEntry(signedNoDocAgg, 'totalAmount'),
      contractsWithLegacyPdfUrlMissingDocument: healthEntry(legacyContractAgg, 'totalAmount'),
    };

    // ── Cashflow trend: last 6 months (collected vs due) ──────────────────────
    const trendSlots = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1),
      );
      return {
        start: d,
        end: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)),
        month: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
        label: new Intl.DateTimeFormat('ar-EG', {
          month: 'short',
          timeZone: 'UTC',
        }).format(d),
      };
    });

    const [trendCollected, trendDue] = await Promise.all([
      Promise.all(
        trendSlots.map(({ start, end }) =>
          this.prisma.deposit.aggregate({
            where: baseDepWhere({ paidAt: { gte: start, lt: end } }),
            _sum: { amount: true },
          }),
        ),
      ),
      Promise.all(
        trendSlots.map(({ start, end }) =>
          this.prisma.installment.aggregate({
            where: instWhere({ dueDate: { gte: start, lt: end } }),
            _sum: { amount: true },
          }),
        ),
      ),
    ]);

    const cashflowTrend = trendSlots.map(({ month, label }, i) => ({
      month,
      label,
      collected: Number(trendCollected[i]?._sum.amount ?? 0),
      due: Number(trendDue[i]?._sum.amount ?? 0),
    }));

    return {
      summary: {
        totalContractValue: (
          totalContractAgg._sum.totalAmount ?? zero
        ).toString(),
        // Existing field kept = ALL deposits (verified + unverified) for
        // back-compat. New verified-only figure is the bankable headline.
        totalCollected: (totalCollectedAgg._sum.amount ?? zero).toString(),
        totalRemaining: (totalRemainingAgg._sum.amount ?? zero).toString(),
        totalOverdue: (totalOverdueAgg._sum.amount ?? zero).toString(),
        collectedThisMonth: (
          collectedThisMonthAgg._sum.amount ?? zero
        ).toString(),
        dueThisMonth: (dueThisMonthAgg._sum.amount ?? zero).toString(),
        contractCount,
        depositCount,
        // Stored-status overdue count (kept for back-compat).
        overdueInstallmentCount: overdueCount,
        // ── F1 additions ──
        totalCollectedAll: collectedAll.toString(),
        totalCollectedVerified: collectedVerified.toString(),
        totalCollectedUnverified: collectedUnverified.toString(),
        totalOutstanding: (outstandingAgg._sum.amount ?? zero).toString(),
        dueSoonAmount: (dueSoonAgg._sum.amount ?? zero).toString(),
        overdueAmountComputed: (overdueComputedAgg._sum.amount ?? zero).toString(),
        overdueInstallmentCountComputed: overdueComputedAgg._count?._all ?? 0,
      },
      collectionByType,
      aging,
      booking,
      liabilities,
      documentsHealth,
      overdue: overdueRows,
      upcomingThisWeek: upcomingWeekRows,
      upcomingThisMonth: upcomingMonthRows,
      recentDeposits,
      cashflowTrend,
      cashflowForecast: {
        next30:   Number(forecast30Agg._sum.amount   ?? 0),
        next3160: Number(forecast3160Agg._sum.amount ?? 0),
        next6190: Number(forecast6190Agg._sum.amount ?? 0),
      },
    };
  }

  // ── CSV builders ─────────────────────────────────────────────────────────
  // Each builder takes the already-computed report payload and emits a CSV
  // string with a UTF-8 BOM (Excel-friendly Arabic). Reuses the service's
  // existing data methods — no new business logic.

  async salesCsv(period?: string, dateFrom?: string, dateTo?: string): Promise<string> {
    const data = await this.sales(period, dateFrom, dateTo);

    // Section 1 — summary KPIs (one row per metric)
    const summaryRows: CsvCell[][] = [
      ['الفترة', period ?? 'الكل'],
      ['عدد العقود', data.contracts],
      ['إجمالي قيمة العقود', Number(data.total).toFixed(2)],
    ];

    // Section 2 — per-project breakdown
    const projectHeaders = ['معرّف المشروع', 'عدد العقود', 'إجمالي القيمة'];
    const projectRows: CsvCell[][] = (data.byProject ?? []).map((p) => [
      p.projectId,
      p.count,
      Number(p.total).toFixed(2),
    ]);

    return [
      toCsv(['المؤشر', 'القيمة'], summaryRows),
      '',
      toCsv(projectHeaders, projectRows),
    ].join('\r\n');
  }

  /**
   * P15.4 — sales as a board-style XLSX: branded cover with an executive summary
   * (lead/visit/contract/sales KPIs), a sales-by-project bar chart, and a detail
   * sheet. Same real `sales()` + `kpis()` data as the CSV; project names resolved
   * for the chart/table. Chart degrades gracefully to tables-only on failure.
   */
  async salesBoardXlsx(period?: string, dateFrom?: string, dateTo?: string): Promise<Buffer> {
    const [data, k] = await Promise.all([this.sales(period, dateFrom, dateTo), this.kpis()]);

    const ids = (data.byProject ?? []).map((p) => p.projectId);
    const projects = ids.length
      ? await this.prisma.project.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
      : [];
    const nameById = new Map(projects.map((p) => [p.id, translatableAr(p.name)]));
    const byProject = (data.byProject ?? []).map((p) => ({
      name: nameById.get(p.projectId) ?? p.projectId,
      count: p.count,
      total: Number(p.total),
    }));

    const projectChart = await renderBarChartPng({
      title: 'المبيعات حسب المشروع',
      series: byProject.slice(0, 8).map((p) => ({ label: p.name, value: p.total })),
    });

    const SPAN = 6;
    const wb = createReportWorkbook();
    const cover = wb.addWorksheet('الملخص');
    setupBoardSheet(cover, { widths: [16, 16, 16, 16, 16, 16], landscape: true });
    addBoardBanner(cover, 'تقرير المبيعات', SPAN, { wb, logo: brandLogoPng() });
    addSectionTitle(cover, 'الملخص التنفيذي', SPAN);
    addKpiCards(
      cover,
      [
        { label: 'الفترة', value: period ?? 'الكل' },
        { label: 'عدد العقود', value: data.contracts },
        { label: 'إجمالي قيمة العقود', value: Number(data.total) },
        { label: 'إجمالي الفرص', value: k.leads.total },
        { label: 'فرص جديدة', value: k.leads.new },
        { label: 'زيارات قيد الانتظار', value: k.pendingVisits },
      ],
      { span: SPAN, perRow: 3 },
    );
    addChartBlock(wb, cover, 'المبيعات حسب المشروع', projectChart, { span: SPAN, width: 720, height: 320 });
    addFooter(cover);

    const detail = wb.addWorksheet('المبيعات حسب المشروع');
    addTable(
      detail,
      ['المشروع', 'عدد العقود', 'إجمالي القيمة'],
      byProject.map((p) => [p.name, p.count, p.total]),
      [30, 14, 18],
    );
    detail.getColumn(3).numFmt = '#,##0.##';

    return workbookToBuffer(wb);
  }

  async financialCsv(period?: string, dateFrom?: string, dateTo?: string): Promise<string> {
    const data = await this.financial(period, dateFrom, dateTo);
    const rows: CsvCell[][] = [
      ['الفترة', period ?? 'الكل'],
      ['عدد الدفعات', data.deposits],
      ['الدفعات الموثّقة', data.verified],
      ['إجمالي المبالغ المحصّلة', Number(data.total).toFixed(2)],
    ];
    return toCsv(['المؤشر', 'القيمة'], rows);
  }

  /**
   * P15.4 — financial collections as a board-style XLSX: branded cover with an
   * executive summary and a verified-vs-unverified deposit doughnut. Same real
   * `financial()` data as the CSV. Chart degrades gracefully to tables-only.
   */
  async financialBoardXlsx(period?: string, dateFrom?: string, dateTo?: string): Promise<Buffer> {
    const data = await this.financial(period, dateFrom, dateTo);
    const unverified = Math.max(0, data.deposits - data.verified);

    const statusChart = await renderDoughnutChartPng({
      title: 'توزيع الدفعات حسب التوثيق',
      series: [
        { label: 'موثّقة', value: data.verified },
        { label: 'غير موثّقة', value: unverified },
      ],
    });

    const SPAN = 6;
    const wb = createReportWorkbook();
    const cover = wb.addWorksheet('الملخص');
    setupBoardSheet(cover, { widths: [16, 16, 16, 16, 16, 16], landscape: true });
    addBoardBanner(cover, 'التقرير المالي', SPAN, { wb, logo: brandLogoPng() });
    addSectionTitle(cover, 'الملخص التنفيذي', SPAN);
    addKpiCards(
      cover,
      [
        { label: 'الفترة', value: period ?? 'الكل' },
        { label: 'عدد الدفعات', value: data.deposits },
        { label: 'الدفعات الموثّقة', value: data.verified },
        { label: 'الدفعات غير الموثّقة', value: unverified },
        { label: 'إجمالي المبالغ المحصّلة', value: Number(data.total) },
      ],
      { span: SPAN, perRow: 3 },
    );
    addChartBlock(wb, cover, 'توزيع الدفعات حسب التوثيق', statusChart, { span: SPAN, width: 560, height: 320 });
    addFooter(cover);

    return workbookToBuffer(wb);
  }

  async operationalCsv(): Promise<string> {
    // Operational export bundles two existing reads: KPIs + reservation
    // breakdown by status. They are emitted as two stacked tables so the
    // user can read them with a single download.
    const [k, r] = await Promise.all([this.kpis(), this.reservations()]);

    const kpiRows: CsvCell[][] = [
      ['المشاريع المنشورة', k.projects],
      ['إجمالي الوحدات', k.units.total],
      ['وحدات متاحة', k.units.available],
      ['وحدات محجوزة', k.units.reserved],
      ['وحدات مباعة', k.units.sold],
      ['إجمالي العملاء المتصفّحين (Leads)', k.leads.total],
      ['عملاء جدد', k.leads.new],
      ['زيارات قيد الانتظار', k.pendingVisits],
      ['عدد العقود', k.contracts],
      ['إجمالي الدفعات المحصّلة', Number(k.depositsTotal).toFixed(2)],
    ];

    const reservationRows: CsvCell[][] = Object.entries(r).map(
      ([status, count]) => [status, count],
    );

    return [
      toCsv(['المؤشر', 'القيمة'], kpiRows),
      '',
      toCsv(['حالة الحجز', 'العدد'], reservationRows),
    ].join('\r\n');
  }

  /**
   * P15.3 — styled XLSX twin of operationalCsv. Same two real reads (KPIs +
   * reservation breakdown), one sheet per table. No demo values.
   */
  async operationalXlsx(): Promise<Buffer> {
    const [k, r] = await Promise.all([this.kpis(), this.reservations()]);
    const wb = createReportWorkbook();

    const kpiSheet = wb.addWorksheet('المؤشرات');
    addTitledTable(kpiSheet, {
      title: 'التقرير التشغيلي',
      headers: ['المؤشر', 'القيمة'],
      rows: [
        ['المشاريع المنشورة', k.projects],
        ['إجمالي الوحدات', k.units.total],
        ['وحدات متاحة', k.units.available],
        ['وحدات محجوزة', k.units.reserved],
        ['وحدات مباعة', k.units.sold],
        ['إجمالي العملاء المتصفّحين (Leads)', k.leads.total],
        ['عملاء جدد', k.leads.new],
        ['زيارات قيد الانتظار', k.pendingVisits],
        ['عدد العقود', k.contracts],
        ['إجمالي الدفعات المحصّلة', Number(k.depositsTotal)],
      ],
      widths: [34, 18],
    });
    kpiSheet.getColumn(2).numFmt = '#,##0.##';
    addFooter(kpiSheet);

    const resSheet = wb.addWorksheet('الحجوزات حسب الحالة');
    addTable(
      resSheet,
      ['حالة الحجز', 'العدد'],
      Object.entries(r).map(([status, count]) => [status, Number(count)]),
      [26, 14],
    );

    return workbookToBuffer(wb);
  }

  async financialDashboardCsv(opts: {
    projectId?: string;
    q?: string;
    type?: DepositType;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<string> {
    const data = await this.financialDashboard(opts);
    const s = data.summary;

    // A. Summary — metric key (stable) + Arabic label + value.
    const summaryRows: CsvCell[][] = [
      ['totalContractValue', 'إجمالي قيمة العقود', s.totalContractValue],
      ['totalCollectedVerified', 'المحصّل المؤكد', s.totalCollectedVerified],
      ['totalCollectedAll', 'إجمالي المحصّل المسجل', s.totalCollectedAll],
      ['totalCollectedUnverified', 'المحصّل غير المؤكد', s.totalCollectedUnverified],
      ['totalOutstanding', 'المتبقي للتحصيل', s.totalOutstanding],
      ['dueSoonAmount', 'مستحق خلال 7 أيام', s.dueSoonAmount],
      ['overdueAmountComputed', 'المتأخر المحسوب', s.overdueAmountComputed],
      ['overdueInstallmentCountComputed', 'عدد الأقساط المتأخرة (محسوبة)', s.overdueInstallmentCountComputed],
      ['totalRemaining', 'المتبقي (قديم)', s.totalRemaining],
      ['totalOverdue', 'المتأخر (قديم)', s.totalOverdue],
      ['collectedThisMonth', 'المحصّل هذا الشهر', s.collectedThisMonth],
      ['dueThisMonth', 'المستحق هذا الشهر', s.dueThisMonth],
      ['contractCount', 'عدد العقود', s.contractCount],
      ['depositCount', 'عدد الدفعات', s.depositCount],
    ];

    // ── Arabic label maps for the new sections ──
    const DEP_TYPE_LABEL: Record<string, string> = {
      BOOKING_AMOUNT: 'مبلغ الحجز',
      DOWN_PAYMENT: 'دفعة أولى',
      INSTALLMENT: 'قسط شهري',
      FINAL_PAYMENT: 'دفعة أخيرة',
    };
    const AGING_LABEL: Record<string, string> = {
      '1-30': '1-30 يوم',
      '31-60': '31-60 يوم',
      '61-90': '61-90 يوم',
      '90+': '90+ يوم',
    };

    // B. Collection by deposit type.
    const byTypeRows: CsvCell[][] = data.collectionByType.map((c) => [
      c.type,
      DEP_TYPE_LABEL[c.type] ?? c.type,
      c.count,
      c.totalAll,
      c.totalVerified,
      c.totalUnverified,
    ]);

    // C. Aging buckets.
    const agingRows: CsvCell[][] = data.aging.map((a) => [
      AGING_LABEL[a.label] ?? a.label,
      a.count,
      a.amount,
    ]);

    // D. Booking pipeline.
    const b = data.booking;
    const bookingRows: CsvCell[][] = [
      ['pendingReservationsCount', 'حجوزات قيد المراجعة (عدد)', b.pendingReservationsCount],
      ['approvedReservationsCount', 'حجوزات معتمدة (عدد)', b.approvedReservationsCount],
      ['pendingReservationsBookingAmount', 'مبالغ حجوزات قيد المراجعة', b.pendingReservationsBookingAmount],
      ['approvedReservationsBookingAmount', 'مبالغ حجوزات معتمدة', b.approvedReservationsBookingAmount],
      ['bookingCollectedVerified', 'مبالغ الحجز المؤكدة', b.bookingCollectedVerified],
      ['bookingCollectedAll', 'مبالغ الحجز المسجلة', b.bookingCollectedAll],
      ['bookingUncollectedEstimate', 'تقدير غير المحصّل', b.bookingUncollectedEstimate],
    ];

    // E. Commissions & liabilities.
    const L = data.liabilities;
    const liabilityRows: CsvCell[][] = [
      ['salesBonus', 'pending', 'مستحقات المبيعات - معلّق', L.salesBonus.pendingCount, L.salesBonus.pendingAmount],
      ['salesBonus', 'approved', 'مستحقات المبيعات - معتمد', L.salesBonus.approvedCount, L.salesBonus.approvedAmount],
      ['salesBonus', 'paid', 'مستحقات المبيعات - مدفوع', L.salesBonus.paidCount, L.salesBonus.paidAmount],
      ['salesBonus', 'unpaid', 'مستحقات المبيعات - غير مدفوع', L.salesBonus.unpaidCount, L.salesBonus.unpaidAmount],
      ['brokerCommissions', 'pending', 'عمولات الوسطاء - معلّق', L.brokerCommissions.pendingCount, L.brokerCommissions.pendingAmount],
      ['brokerCommissions', 'approved', 'عمولات الوسطاء - معتمد', L.brokerCommissions.approvedCount, L.brokerCommissions.approvedAmount],
      ['brokerCommissions', 'paid', 'عمولات الوسطاء - مدفوع', L.brokerCommissions.paidCount, L.brokerCommissions.paidAmount],
      ['brokerCommissions', 'unpaid', 'عمولات الوسطاء - غير مدفوع', L.brokerCommissions.unpaidCount, L.brokerCommissions.unpaidAmount],
      ['brokerPayouts', 'draft', 'دفعات الوسطاء - مسودة', L.brokerPayouts.draftCount, L.brokerPayouts.draftAmount],
      ['brokerPayouts', 'approved', 'دفعات الوسطاء - معتمدة', L.brokerPayouts.approvedCount, L.brokerPayouts.approvedAmount],
      ['brokerPayouts', 'processing', 'دفعات الوسطاء - قيد المعالجة', L.brokerPayouts.processingCount, L.brokerPayouts.processingAmount],
      ['brokerPayouts', 'paid', 'دفعات الوسطاء - مدفوعة', L.brokerPayouts.paidCount, L.brokerPayouts.paidAmount],
      ['total', 'unpaid', 'إجمالي الالتزامات غير المدفوعة', '', L.totalUnpaidLiabilities],
    ];

    // F. Documents / receipts health.
    const H = data.documentsHealth;
    const healthRows: CsvCell[][] = [
      ['depositsMissingReceipt', 'دفعات مؤكدة بدون إيصال', H.depositsMissingReceipt.count, H.depositsMissingReceipt.amount],
      ['verifiedDepositsMissingReceiptDocument', 'دفعات مؤكدة بدون مستند إيصال', H.verifiedDepositsMissingReceiptDocument.count, H.verifiedDepositsMissingReceiptDocument.amount],
      ['depositsWithLegacyReceiptUrlMissingDocument', 'إيصالات قديمة غير مربوطة كمستند', H.depositsWithLegacyReceiptUrlMissingDocument.count, H.depositsWithLegacyReceiptUrlMissingDocument.amount],
      ['signedContractsMissingDocument', 'عقود موقعة بدون مستند عقد', H.signedContractsMissingDocument.count, H.signedContractsMissingDocument.amount],
      ['contractsWithLegacyPdfUrlMissingDocument', 'ملفات عقود قديمة غير مربوطة كمستند', H.contractsWithLegacyPdfUrlMissingDocument.count, H.contractsWithLegacyPdfUrlMissingDocument.amount],
    ];

    // We use a permissive shape here — the report payload's nested selects
    // vary slightly between branches and aren't worth a new exported type
    // just for the CSV builder.
    type InstRow = {
      id: string;
      type: string;
      dueDate: Date | string;
      amount: Prisma.Decimal | string | number;
      status: string;
      plan: {
        contract: {
          contractNumber: string | null;
          customer: { fullName: string };
          unit: { code: string };
        };
      };
    };
    type DepositRow = {
      id: string;
      type: string;
      amount: Prisma.Decimal | string | number;
      paidAt: Date | string;
      verified: boolean;
      contract:
        | {
            contractNumber: string | null;
            customer: { fullName: string } | null;
            unit: { code: string } | null;
          }
        | null;
      reservation:
        | {
            reservationNumber: string | null;
            unit: { code: string } | null;
            client: { fullName: string } | null;
            lead: { fullName: string } | null;
          }
        | null;
    };

    const fmtInst = (rows: InstRow[]): CsvCell[][] =>
      rows.map((r) => [
        r.plan.contract.contractNumber ?? '',
        r.plan.contract.customer.fullName,
        r.plan.contract.unit.code,
        r.type,
        new Date(r.dueDate).toISOString().slice(0, 10),
        r.amount.toString(),
        r.status,
      ]);

    const overdueRows = fmtInst(data.overdue as unknown as InstRow[]);
    const weekRows = fmtInst(data.upcomingThisWeek as unknown as InstRow[]);
    const monthRows = fmtInst(data.upcomingThisMonth as unknown as InstRow[]);

    const depositRows: CsvCell[][] = (
      data.recentDeposits as unknown as DepositRow[]
    ).map((d) => [
      d.contract?.contractNumber ?? d.reservation?.reservationNumber ?? '',
      d.contract?.customer?.fullName ??
        d.reservation?.client?.fullName ??
        d.reservation?.lead?.fullName ??
        '',
      d.contract?.unit?.code ?? d.reservation?.unit?.code ?? '',
      d.type,
      new Date(d.paidAt).toISOString().slice(0, 10),
      d.amount.toString(),
      d.verified ? 'نعم' : 'لا',
    ]);

    const instHeaders = [
      'رقم العقد',
      'العميل',
      'كود الوحدة',
      'النوع',
      'تاريخ الاستحقاق',
      'المبلغ',
      'الحالة',
    ];
    const depHeaders = [
      'المرجع',
      'العميل',
      'كود الوحدة',
      'النوع',
      'تاريخ السداد',
      'المبلغ',
      'موثّقة',
    ];

    return [
      '# ملخص',
      toCsv(['المؤشر', 'البيان', 'القيمة'], summaryRows),
      '',
      '# التحصيل حسب النوع',
      toCsv(['النوع', 'البيان', 'العدد', 'إجمالي مسجل', 'مؤكد', 'غير مؤكد'], byTypeRows),
      '',
      '# أعمار المتأخرات',
      toCsv(['الفئة', 'العدد', 'المبلغ'], agingRows),
      '',
      '# خط الحجوزات',
      toCsv(['المؤشر', 'البيان', 'القيمة'], bookingRows),
      '',
      '# العمولات والالتزامات',
      toCsv(['القسم', 'الحالة', 'البيان', 'العدد', 'المبلغ'], liabilityRows),
      '',
      '# سلامة المستندات والإيصالات',
      toCsv(['المؤشر', 'البيان', 'العدد', 'المبلغ'], healthRows),
      '',
      '# الأقساط المتأخرة',
      toCsv(instHeaders, overdueRows),
      '',
      '# أقساط مستحقة هذا الأسبوع',
      toCsv(instHeaders, weekRows),
      '',
      '# أقساط مستحقة هذا الشهر',
      toCsv(instHeaders, monthRows),
      '',
      '# آخر الدفعات',
      toCsv(depHeaders, depositRows),
    ].join('\r\n');
  }

  /**
   * P15.4 — financial dashboard as a board-style XLSX: branded cover with an
   * executive summary, real-derived alerts, an aging bar chart + a collection-
   * by-type doughnut, plus detail sheets. Same real `financialDashboard()` data
   * (and filters) as the CSV. Charts degrade gracefully to tables-only.
   */
  async financialDashboardXlsx(opts: {
    projectId?: string;
    q?: string;
    type?: DepositType;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<Buffer> {
    const data = await this.financialDashboard(opts);
    const s = data.summary;
    const DEP_TYPE_LABEL: Record<string, string> = {
      BOOKING_AMOUNT: 'مبلغ الحجز',
      DOWN_PAYMENT: 'دفعة أولى',
      INSTALLMENT: 'قسط شهري',
      FINAL_PAYMENT: 'دفعة أخيرة',
    };
    const AGING_LABEL: Record<string, string> = {
      '1-30': '1-30 يوم', '31-60': '31-60 يوم', '61-90': '61-90 يوم', '90+': '90+ يوم',
    };

    const agingChart = await renderBarChartPng({
      title: 'أعمار المتأخرات',
      series: data.aging.map((a) => ({ label: AGING_LABEL[a.label] ?? a.label, value: Number(a.amount) })),
    });
    const typeChart = await renderDoughnutChartPng({
      title: 'التحصيل حسب نوع الدفعة',
      series: data.collectionByType.map((c) => ({ label: DEP_TYPE_LABEL[c.type] ?? c.type, value: Number(c.totalAll) })),
    });

    const SPAN = 6;
    const wb = createReportWorkbook();
    const cover = wb.addWorksheet('الملخص');
    setupBoardSheet(cover, { widths: [16, 16, 16, 16, 16, 16], landscape: true });
    addBoardBanner(cover, 'لوحة المؤشرات المالية', SPAN, { wb, logo: brandLogoPng() });

    addSectionTitle(cover, 'الملخص التنفيذي', SPAN);
    addKpiCards(
      cover,
      [
        { label: 'إجمالي قيمة العقود', value: Number(s.totalContractValue) },
        { label: 'المحصّل المؤكد', value: Number(s.totalCollectedVerified) },
        { label: 'المحصّل غير المؤكد', value: Number(s.totalCollectedUnverified) },
        { label: 'المتبقي للتحصيل', value: Number(s.totalOutstanding) },
        { label: 'المحصّل هذا الشهر', value: Number(s.collectedThisMonth) },
        { label: 'المستحق هذا الشهر', value: Number(s.dueThisMonth) },
        { label: 'عدد العقود', value: s.contractCount },
        { label: 'عدد الدفعات', value: s.depositCount },
      ],
      { span: SPAN, perRow: 3 },
    );

    addSectionTitle(cover, 'التنبيهات والمخاطر', SPAN);
    const alertCards = (
      [
        ['مستحق خلال 7 أيام', Number(s.dueSoonAmount)],
        ['المتأخر المحسوب', Number(s.overdueAmountComputed)],
        ['عدد الأقساط المتأخرة', Number(s.overdueInstallmentCountComputed)],
        ['إجمالي الالتزامات غير المدفوعة', Number(data.liabilities.totalUnpaidLiabilities)],
      ] as Array<[string, number]>
    ).filter(([, v]) => v > 0);
    addKpiCards(
      cover,
      alertCards.map(([label, value]) => ({ label, value })),
      { span: SPAN, perRow: 3, bg: XLSX_ALERT_BG },
    );

    addChartBlock(wb, cover, 'أعمار المتأخرات', agingChart, { span: SPAN, width: 720, height: 300 });
    addChartBlock(wb, cover, 'التحصيل حسب نوع الدفعة', typeChart, { span: SPAN, width: 560, height: 300 });
    addFooter(cover);

    const byType = wb.addWorksheet('التحصيل حسب النوع');
    addTable(
      byType,
      ['النوع', 'العدد', 'الإجمالي', 'المؤكد', 'غير المؤكد'],
      data.collectionByType.map((c) => [
        DEP_TYPE_LABEL[c.type] ?? c.type, c.count,
        Number(c.totalAll), Number(c.totalVerified), Number(c.totalUnverified),
      ]),
      [20, 12, 16, 16, 16],
    );

    const aging = wb.addWorksheet('أعمار المتأخرات');
    addTable(
      aging,
      ['الفئة', 'العدد', 'المبلغ'],
      data.aging.map((a) => [AGING_LABEL[a.label] ?? a.label, a.count, Number(a.amount)]),
      [18, 12, 18],
    );

    return workbookToBuffer(wb);
  }

  // ── PDF builders ─────────────────────────────────────────────────────────
  // Branded A4 Arabic PDFs using PDFKit + NotoSansArabic font. Each builder
  // fetches the same data as the matching JSON/CSV endpoints so there is no
  // business-logic duplication. Project names are resolved to Arabic labels
  // before being handed to the layout utility.

  async salesPdf(period?: string, dateFrom?: string, dateTo?: string): Promise<Buffer> {
    const data = await this.sales(period, dateFrom, dateTo);

    // Resolve Arabic project names for the breakdown table.
    const ids = (data.byProject ?? []).map((p) => p.projectId);
    const projects = ids.length
      ? await this.prisma.project.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(projects.map((p) => [p.id, translatableAr(p.name)]));

    return buildSalesPdf({
      contracts: data.contracts,
      total: Number(data.total),
      byProject: (data.byProject ?? []).map((p) => ({
        name: nameById.get(p.projectId) ?? p.projectId,
        count: p.count,
        total: Number(p.total),
      })),
      period,
      dateFrom,
      dateTo,
    });
  }

  async financialPdf(period?: string, dateFrom?: string, dateTo?: string): Promise<Buffer> {
    const data = await this.financial(period, dateFrom, dateTo);
    return buildFinancialPdf({
      deposits: data.deposits,
      verified: data.verified,
      total: Number(data.total),
      period,
      dateFrom,
      dateTo,
    });
  }

  async brokerPdf(dateFrom?: string, dateTo?: string): Promise<Buffer> {
    const brokers = await this.brokerLeaderboard(dateFrom, dateTo);
    return buildBrokerPdf({
      brokers: brokers.map((b) => ({
        brokerName: b.brokerName,
        count: b.count,
        commissionAmount: b.commissionAmount,
      })),
      dateFrom,
      dateTo,
    });
  }

  private periodWhereContract(period: string): Prisma.ContractWhereInput {
    const [y, m] = period.split('-').map(Number);
    const start = new Date(Date.UTC(y!, (m ?? 1) - 1, 1));
    const end = new Date(Date.UTC(y!, m!, 1));
    return { createdAt: { gte: start, lt: end } };
  }

  private periodWhereDeposit(period: string): Prisma.DepositWhereInput {
    const [y, m] = period.split('-').map(Number);
    const start = new Date(Date.UTC(y!, (m ?? 1) - 1, 1));
    const end = new Date(Date.UTC(y!, m!, 1));
    return { paidAt: { gte: start, lt: end } };
  }
}
