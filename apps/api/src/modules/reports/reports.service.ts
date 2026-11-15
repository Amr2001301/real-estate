import { DEPOSIT_STATE_SELECT, withDepositState } from '../../common/finance/deposit-state';
import { Injectable, Optional } from '@nestjs/common';
import {
  AppointmentStatus,
  BonusEntryStatus,
  BrokerCommissionStatus,
  BrokerPayoutStatus,
  ClawbackStatus,
  DepositType,
  DocumentCategory,
  DocumentOwnerType,
  PaymentInstrumentType,
  InfoRequestStatus,
  InstallmentStatus,
  MaintenanceStatus,
  Prisma,
  ReservationBookingPaymentStatus,
  ReservationStatus,
  UnitStatus,
  UserRole,
} from '@prisma/client';
import { awaitingReviewerWhere } from '../deposits/review-queue';
import { PrismaService } from '../../common/prisma/prisma.service';
import { scopedUserCount } from '../../common/tenant/resolve-tenant-entity';
import { getRequiredCompanyId, getTenantContext } from '../../common/tenant/tenant-context';
import {
  COMPANY_TIMEZONE_DEFAULT,
  companyTimeZone,
  currentCompanyTimeZone,
  startOfLocalToday,
} from '../../common/time/company-timezone';
import { localDate, localMonth, reportRange } from '../../common/time/report-range';
import { getCompanyCurrency } from '../../common/currency/currency';
import { fallbackBrand, type ReportBrand } from '../../common/utils/report-brand';
import { ReportBrandService } from '../company-branding/report-brand.service';
import { presentReportPdf, ReportPdfService } from '../../common/report-pdf/report-pdf.service';
import {
  dashboardReportHtml,
  DEPOSIT_TYPE_AR,
  financialDashboardReportHtml,
  operationalReportHtml,
  salesReportHtml,
} from './report-templates';
import { buildSalesPdf } from '../../common/utils/pdf';
import {
  XLSX_ALERT_BG,
  addBoardBanner,
  addChartBlock,
  addFooter,
  addKpiCards,
  addSectionTitle,
  addTable,
  addTitledTable,
  amountFormat,
  createReportWorkbook,
  excelLocalDate,
  formatMoneyColumns,
  setupBoardSheet,
  styleTotalsRow,
  workbookToBuffer,
} from '../../common/utils/xlsx';
import {
  renderBarChartPng,
  renderShareChartPng,
} from '../../common/utils/xlsx-chart';
import {
  AWAITING_DEPOSIT_WHERE,
  COLLECTED_DEPOSIT_WHERE,
  FEES_DEPOSIT_WHERE,
  RECORDED_DEPOSIT_WHERE,
  TOWARDS_PRICE_DEPOSIT_WHERE,
} from '../../common/finance/collected';
import { dueToDateSplit, portfolioSplit } from './portfolio-split';
import { buildFinancialDetail, DETAIL_LIMIT } from './financial-detail';
import { commissionBasis, MARKUP_SNAPSHOT_SELECT, NET_PRICE_SQL, netContractValue } from '../../common/finance/commission-basis';
import {
  BILLABLE_PLAN_WHERE,
  LIVE_CONTRACT_WHERE,
  LIVE_PLAN_WHERE,
  PAYABLE_DEAL_WHERE,
  PAYMENT_ON_ITS_WAY,
  SURCHARGE_PAYMENT_TYPES,
} from '../installments/live-contract';

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

/** "2026-09", "من 2026-01-01 إلى 2026-03-31" or «كل الفترات». */
function reportPeriodLabel(period?: string, dateFrom?: string, dateTo?: string): string {
  if (period) return period;
  if (dateFrom && dateTo) return `من ${dateFrom} إلى ${dateTo}`;
  if (dateFrom) return `من ${dateFrom}`;
  if (dateTo) return `حتى ${dateTo}`;
  return 'كل الفترات';
}

/** The dashboard report's alerts section when nothing is waiting on anyone. */
const NO_OPEN_ALERTS = 'لا توجد تنبيهات معلقة';

/** The financial report's applied filters, labelled; the period last (it becomes a fact card). */
function financialFilterPairs(
  opts: { type?: DepositType; q?: string; dateFrom?: string; dateTo?: string },
  projectName: string | null | undefined,
): Array<[string, string]> {
  const period = reportPeriodLabel(undefined, opts.dateFrom, opts.dateTo);
  return [
    projectName ? (['المشروع', projectName] as [string, string]) : null,
    opts.type ? (['النوع', DEPOSIT_TYPE_AR[opts.type] ?? opts.type] as [string, string]) : null,
    opts.q ? (['بحث', opts.q] as [string, string]) : null,
    period !== 'كل الفترات' ? (['الفترة', period] as [string, string]) : null,
  ].filter((f): f is [string, string] => f !== null);
}

/** Money going out, as the financial report's outflows table reads it. */
function financialOutflows(data: {
  liabilities: {
    brokerCommissions: { pendingAmount: string; unpaidAmount: string; paidAmount: string };
    salesBonus: { pendingAmount: string; approvedAmount: string; paidAmount: string };
    clawbacksOwed: { totalAmount: string };
  };
  summary: { refundsOwed: string; refundsPaid: string };
}) {
  return {
    brokerCommissions: data.liabilities.brokerCommissions,
    salesBonus: data.liabilities.salesBonus,
    refundsOwed: data.summary.refundsOwed,
    refundsPaid: data.summary.refundsPaid,
    clawbacksOwed: data.liabilities.clawbacksOwed.totalAmount,
  };
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    // Optional so unit tests can build the service with prisma only.
    @Optional() private readonly reportBrand?: ReportBrandService,
    @Optional() private readonly reportPdf?: ReportPdfService,
  ) {}

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
      // Contracts are signed ones, as everywhere (decided 2026-10-17).
      this.prisma.contract.count({ where: { signedAt: { not: null }, ...LIVE_CONTRACT_WHERE } }),
      this.prisma.deposit.aggregate({ where: COLLECTED_DEPOSIT_WHERE, _sum: { amount: true } }),
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

  /** The company's time zone, read only when a report is filtered by date. */
  private async rangeTimeZone(from?: string, to?: string): Promise<string> {
    return from || to ? companyTimeZone(this.prisma, getRequiredCompanyId()) : COMPANY_TIMEZONE_DEFAULT;
  }

  async sales(period?: string, dateFrom?: string, dateTo?: string) {
    const tz = await this.rangeTimeZone(dateFrom, dateTo);
    const companyId = getRequiredCompanyId();
    // Sales are signed, live contracts, counted by the signing date (decided
    // 2026-10-16): a cancelled or deleted deal is not a sale, nor an unsigned one.
    let where: Prisma.ContractWhereInput = { signedAt: { not: null } };
    const conditions: Prisma.Sql[] = [
      Prisma.sql`c."companyId" = ${companyId}::uuid`,
      Prisma.sql`c."status" <> 'CANCELLED'`,
      Prisma.sql`c."deletedAt" IS NULL`,
      Prisma.sql`c."signedAt" IS NOT NULL`,
    ];
    if (dateFrom || dateTo) {
      const r = reportRange(dateFrom, dateTo, tz);
      where = { signedAt: { not: null, ...r } };
      if (r.gte) conditions.push(Prisma.sql`c."signedAt" >= ${r.gte}`);
      if (r.lt) conditions.push(Prisma.sql`c."signedAt" < ${r.lt}`);
    } else if (period) {
      where = await this.periodWhereContract(period);
      const { start, end } = await this.periodMonth(period);
      conditions.push(Prisma.sql`c."signedAt" >= ${start}`, Prisma.sql`c."signedAt" < ${end}`);
    }
    const whereClause = conditions.length
      ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
      : Prisma.empty;
    where = { ...where, ...LIVE_CONTRACT_WHERE };
    // Sales are the net price, without the instalment markup (decided
    // 2026-10-17, as the commission base).
    const [count, total, byProject] = await Promise.all([
      this.prisma.contract.count({ where }),
      netContractValue(this.prisma, where),
      this.prisma.$queryRaw<Array<{ projectId: string; total: number; count: number }>>(Prisma.sql`
        SELECT p.id as "projectId", COUNT(c.*)::int as count, COALESCE(SUM(${NET_PRICE_SQL}), 0)::float as total
        FROM "Contract" c
        LEFT JOIN "Reservation" r ON r.id = c."reservationId"
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
      total,
      byProject,
    };
  }

  async financial(period?: string, dateFrom?: string, dateTo?: string) {
    const tz = await this.rangeTimeZone(dateFrom, dateTo);
    let where: Prisma.DepositWhereInput = {};
    if (dateFrom || dateTo) {
      where = {
        paidAt: {
          ...reportRange(dateFrom, dateTo, tz),
        },
      };
    } else if (period) {
      where = await this.periodWhereDeposit(period);
    }
    // deposits / total: money collected (one definition, see collected.ts);
    // verified: of those, the ones a reviewer confirmed.
    // Collected is two figures (decided 2026-10-16): towards the price, and
    // fees & penalties. `total` is towards the price — the same figure as the
    // dashboard; it used to be everything, cancelled deals included.
    const collected: Prisma.DepositWhereInput = { AND: [where, COLLECTED_DEPOSIT_WHERE] };
    const [count, sum, verified, fees] = await this.prisma.$transaction([
      this.prisma.deposit.count({ where: collected }),
      this.prisma.deposit.aggregate({ where: { AND: [collected, TOWARDS_PRICE_DEPOSIT_WHERE] }, _sum: { amount: true } }),
      this.prisma.deposit.count({ where: { AND: [collected, { verified: true }] } }),
      this.prisma.deposit.aggregate({ where: { AND: [collected, FEES_DEPOSIT_WHERE] }, _sum: { amount: true } }),
    ]);
    return {
      deposits: count,
      verified,
      total: sum._sum.amount ?? 0,
      fees: fees._sum.amount ?? 0,
    };
  }

  async reservations(dateFrom?: string, dateTo?: string) {
    const tz = await this.rangeTimeZone(dateFrom, dateTo);
    // A deleted reservation is not one (the reservations list hides it).
    const where: Prisma.ReservationWhereInput =
      dateFrom || dateTo
        ? {
            deletedAt: null,
            createdAt: {
              ...reportRange(dateFrom, dateTo, tz),
            },
          }
        : { deletedAt: null };
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
    const tz = await this.rangeTimeZone(dateFrom, dateTo);
    const dateCond = {
      ...reportRange(dateFrom, dateTo, tz),
    };
    const hasDate = !!(dateFrom || dateTo);
    const dateWhere = hasDate ? { where: { createdAt: dateCond } } : undefined;
    const [leads, visits, reservations, contracts] = await this.prisma.$transaction([
      this.prisma.lead.count(dateWhere),
      this.prisma.visitRequest.count(dateWhere),
      this.prisma.reservation.count({ where: { deletedAt: null, ...(dateWhere?.where ?? {}) } }),
      this.prisma.contract.count({
        // A sale is a signed contract, counted by its signing date.
        where: { signedAt: hasDate ? { not: null, ...dateCond } : { not: null }, ...LIVE_CONTRACT_WHERE },
      }),
    ]);
    // The four counts are each the period's own activity, so a ratio between
    // two of them (contracts signed this month over reservations made this
    // month) is no conversion and ran past 100%. Conversion follows the
    // period's leads instead: how many of them went on to a visit, a
    // reservation and a signed contract, at any date. A stage includes the
    // ones past it (a lead reserved without a recorded visit still got that
    // far), so each rate is at most the one before it.
    const signed = {
      reservations: {
        some: { deletedAt: null, contract: { signedAt: { not: null }, ...LIVE_CONTRACT_WHERE } },
      },
    } satisfies Prisma.LeadWhereInput;
    const reserved = { reservations: { some: { deletedAt: null } } } satisfies Prisma.LeadWhereInput;
    const cohort = dateWhere?.where ?? {};
    const [visitedLeads, reservedLeads, signedLeads] = await this.prisma.$transaction([
      this.prisma.lead.count({
        where: {
          ...cohort,
          OR: [{ visitRequests: { some: {} } }, { appointments: { some: {} } }, reserved],
        },
      }),
      this.prisma.lead.count({ where: { ...cohort, ...reserved } }),
      this.prisma.lead.count({ where: { ...cohort, ...signed } }),
    ]);
    return {
      leads,
      visits,
      reservations,
      contracts,
      cohort: { leads, visited: visitedLeads, reserved: reservedLeads, signed: signedLeads },
    };
  }

  async brokerLeaderboard(dateFrom?: string, dateTo?: string) {
    const companyId = getRequiredCompanyId();
    const conditions: Prisma.Sql[] = [
      Prisma.sql`bc."companyId" = ${companyId}::uuid`,
      Prisma.sql`bc.status = 'APPROVED'`,
      // Earned and kept (EARNED_COMMISSION_WHERE): the deal live or kept
      // with RETAIN, and no clawback under way (a waived one stays).
      Prisma.sql`(bc."retainedOnCancellation" OR EXISTS (
        SELECT 1 FROM "Contract" ct WHERE ct.id = bc."contractId" AND ct.status <> 'CANCELLED' AND ct."deletedAt" IS NULL))`,
      Prisma.sql`(bc."clawbackStatus" IS NULL OR bc."clawbackStatus" = 'WAIVED')`,
    ];
    const r = reportRange(dateFrom, dateTo, await companyTimeZone(this.prisma, companyId));
    if (r.gte) conditions.push(Prisma.sql`bc."earnedAt" >= ${r.gte}`);
    if (r.lt) conditions.push(Prisma.sql`bc."earnedAt" < ${r.lt}`);
    const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
    return this.prisma.$queryRaw<Array<{
      brokerId: string;
      brokerName: string;
      commissionAmount: number;
      count: number;
    }>>(Prisma.sql`
      SELECT
        br.id                                                     AS "brokerId",
        COALESCE(br."commercialName", br."companyName")           AS "brokerName",
        -- With the price-change top-ups and clawbacks on each commission.
        COALESCE(SUM(bc."netAmount" + COALESCE((
          SELECT SUM(CASE WHEN a.kind = 'TOP_UP' THEN a.amount ELSE -a.amount END)
          FROM "BrokerCommissionAdjustment" a
          WHERE a."commissionId" = bc.id AND NOT a."settlesClawback"
        ), 0)), 0)::float                                         AS "commissionAmount",
        COUNT(bc.id)::int                                         AS count
      FROM "BrokerCommission" bc
      -- brokerId is the broker firm (Broker), not a User: joining "User" made
      -- the leaderboard always empty.
      JOIN "Broker" br ON br.id = bc."brokerId" AND br."companyId" = ${companyId}::uuid
      ${whereClause}
      GROUP BY br.id, br."commercialName", br."companyName"
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
      ? Prisma.sql`AND ph."projectId" = ${projectId}::uuid`
      : Prisma.empty;
    // The signing date's month and year in the company's time zone (signedAt
    // is stored as UTC).
    const tz = await companyTimeZone(this.prisma, companyId);
    const localSigned = Prisma.sql`((c."signedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz})`;
    const rows = await this.prisma.$queryRaw<
      Array<{ month: number; contracts: number; total: number }>
    >(Prisma.sql`
       SELECT EXTRACT(MONTH FROM ${localSigned})::int AS month,
              COUNT(c.*)::int AS contracts,
              COALESCE(SUM(${NET_PRICE_SQL}), 0)::float AS total
       FROM "Contract" c
       LEFT JOIN "Reservation" r ON r.id = c."reservationId"
       ${projectJoin}
       WHERE EXTRACT(YEAR FROM ${localSigned}) = ${safeYear}
       AND c."companyId" = ${companyId}::uuid
       AND c."status" <> 'CANCELLED'
       AND c."deletedAt" IS NULL
       ${projectFilter}
       GROUP BY 1
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
    // Rows due today belong to the next 30 days (they used to be dropped:
    // a due date is midnight at the start of its day, before "now").
    const tz = await currentCompanyTimeZone(this.prisma, getTenantContext()?.companyId);
    const today = startOfLocalToday(tz, now);
    // "This month" is the company's month, not the server's (UTC).
    const { year, month } = localDate(tz, now);
    const startOfMonth = localMonth(year, month, tz).start;
    const expiringHorizon = new Date(now.getTime() +  7 * 24 * 60 * 60 * 1000);
    const prevMonthStart  = localMonth(year, month - 1, tz).start;
    const prevMonthSameDay = new Date(Math.min(startOfMonth.getTime(), prevMonthStart.getTime() + (now.getTime() - startOfMonth.getTime())));
    // From today in the company's time zone, as the financial report.
    const in30            = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const in60            = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
    const in90            = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
    // Signed contracts only, as the financial report: an unsigned contract
    // has nothing due yet and is not in the contract value — counting its
    // rows lowered the collection rate and raised the forecast.
    const SIGNED_PLAN = {
      ...LIVE_PLAN_WHERE,
      contract: { ...LIVE_CONTRACT_WHERE, signedAt: { not: null } },
    } satisfies Prisma.InstallmentPlanWhereInput;
    // The company is named here, not left to the tenant middleware: reached
    // through a relation (a reservation's contract, in the booking sums) the
    // contract is not scoped, and another company's contracts got counted.
    const signedContractWhere: Prisma.ContractWhereInput = {
      companyId: getRequiredCompanyId(),
      signedAt: { not: null },
      ...LIVE_CONTRACT_WHERE,
    };
    // Late: past its due day, nothing on its way — not only what the nightly
    // sweep has marked (the dashboard read 144k late where the report read 1.27m).
    const lateWhere: Prisma.InstallmentWhereInput = {
      status: { in: [InstallmentStatus.PENDING, InstallmentStatus.OVERDUE] },
      plan: { ...BILLABLE_PLAN_WHERE, contract: { ...BILLABLE_PLAN_WHERE.contract, signedAt: { not: null } } },
      deposits: { none: PAYMENT_ON_ITS_WAY },
      dueDate: { lt: today },
    };

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
      // FG-01 — the same rows as the review queue (cheques wait on the bank).
      this.prisma.deposit.count({ where: awaitingReviewerWhere }),
      this.prisma.maintenanceRequest.count({
        where: {
          status: {
            in: [MaintenanceStatus.OPEN, MaintenanceStatus.ASSIGNED, MaintenanceStatus.IN_PROGRESS],
          },
        },
      }),
      this.prisma.contract.count({ where: { signedAt: null, ...LIVE_CONTRACT_WHERE } }),
      // The expiry job lapses approved bookings too.
      this.prisma.reservation.count({
        where: {
          deletedAt: null,
          status: { in: [ReservationStatus.PENDING, ReservationStatus.APPROVED] },
          expiresAt: { gte: now, lte: expiringHorizon },
        },
      }),
      this.prisma.visitAppointment.count({ where: { status: AppointmentStatus.SCHEDULED } }),
      this.prisma.infoRequest.count({ where: { status: InfoRequestStatus.OPEN } }),
      // ── extended inventory / pipeline ──
      this.prisma.unit.count({ where: { status: UnitStatus.SOLD } }),
      this.prisma.contract.count({ where: { signedAt: { not: null }, ...LIVE_CONTRACT_WHERE } }),
      scopedUserCount(this.prisma, { role: UserRole.CUSTOMER }),
      scopedUserCount(this.prisma, {
        role: {
          in: [
            UserRole.ADMIN,
            UserRole.SALES,
            UserRole.SALES_MANAGER,
            UserRole.MAINTENANCE_SUPERVISOR,
          ],
        },
      }),
      // ── funnel all-time volumes ──
      this.prisma.lead.count(),
      this.prisma.visitRequest.count(),
      this.prisma.reservation.count({ where: { deletedAt: null } }),
      this.prisma.contract.count({ where: { signedAt: { not: null }, ...LIVE_CONTRACT_WHERE } }),
      // ── financial aggregates ──
      this.prisma.deposit.aggregate({ where: COLLECTED_DEPOSIT_WHERE, _sum: { amount: true } }),
      this.prisma.installment.aggregate({ where: lateWhere, _sum: { amount: true } }),
      this.prisma.bonusEntry.aggregate({
        where: { status: BonusEntryStatus.PENDING },
        _sum: { amount: true },
      }),
      this.prisma.brokerPayout.aggregate({
        where: { status: { in: [BrokerPayoutStatus.DRAFT, BrokerPayoutStatus.APPROVED] } },
        _sum: { totalNet: true },
      }),
      // ── MTD vs prior-month ──
      // Collected towards the price, this month so far against the same days
      // of last month (a whole month against a few days read as a fall).
      this.prisma.deposit.aggregate({
        where: { AND: [COLLECTED_DEPOSIT_WHERE, TOWARDS_PRICE_DEPOSIT_WHERE, { paidAt: { gte: prevMonthStart, lt: prevMonthSameDay } }] },
        _sum: { amount: true },
      }),
      this.prisma.deposit.aggregate({
        where: { AND: [COLLECTED_DEPOSIT_WHERE, TOWARDS_PRICE_DEPOSIT_WHERE, { paidAt: { gte: startOfMonth } }] },
        _sum: { amount: true },
      }),
      this.prisma.contract.count({
        where: { signedAt: { gte: prevMonthStart, lt: startOfMonth }, ...LIVE_CONTRACT_WHERE },
      }),
      this.prisma.contract.count({ where: { signedAt: { gte: startOfMonth }, ...LIVE_CONTRACT_WHERE } }),
      this.prisma.lead.count({ where: { createdAt: { gte: prevMonthStart, lt: startOfMonth } } }),
      // ── Cash flow forecast (next 30 / 31-60 / 61-90 days) ──
      this.prisma.installment.aggregate({
        where: { status: InstallmentStatus.PENDING, dueDate: { gte: today, lte: in30 }, plan: SIGNED_PLAN },
        _sum: { amount: true },
      }),
      this.prisma.installment.aggregate({
        where: { status: InstallmentStatus.PENDING, dueDate: { gt: in30, lte: in60 }, plan: SIGNED_PLAN },
        _sum: { amount: true },
      }),
      this.prisma.installment.aggregate({
        where: { status: InstallmentStatus.PENDING, dueDate: { gt: in60, lte: in90 }, plan: SIGNED_PLAN },
        _sum: { amount: true },
      }),
    ]);

    // Progress against the price of live contracts: the money and the arrears
    // that count toward it — not fee payments, not deposits on cancelled
    // deals, not bookings that never became a contract. Measured against the
    // all-in collected figure the collection rate could pass 100%.
    // What has fallen due by today towards the price: the booking amounts of
    // live contracts plus their payment rows due up to today (fees and
    // cancelled rows out). The collection rate is measured against this, not
    // against the whole contract value — most of that is not due yet (U5).
    const signedInstWhere = (extra: Prisma.InstallmentWhereInput): Prisma.InstallmentWhereInput => ({
      AND: [{ plan: SIGNED_PLAN }, extra],
    });
    const [collectedTowardsPriceAgg, overdueTowardsPriceAgg, feesCollectedAgg, dueSplit, totalContractValue] = await Promise.all([
      this.prisma.deposit.aggregate({
        where: { AND: [COLLECTED_DEPOSIT_WHERE, TOWARDS_PRICE_DEPOSIT_WHERE] },
        _sum: { amount: true },
      }),
      this.prisma.installment.aggregate({
        where: { ...lateWhere, type: { notIn: SURCHARGE_PAYMENT_TYPES } },
        _sum: { amount: true },
      }),
      this.prisma.deposit.aggregate({
        where: { AND: [COLLECTED_DEPOSIT_WHERE, FEES_DEPOSIT_WHERE] },
        _sum: { amount: true },
      }),
      // The collection rate: settled against what is due by today (decided
      // 2026-10-17), on the schedule rows — early payments don't count.
      dueToDateSplit(this.prisma, { signedContractWhere, instWhere: signedInstWhere, today }),
      // Contract value: signed contracts at their net price (decided 2026-10-17).
      netContractValue(this.prisma, signedContractWhere),
    ]);
    // The contract value split, the same as the financial report's.
    const [split, unsignedCount, unsignedDueCount] = await Promise.all([
      portfolioSplit(this.prisma, {
        signedContractWhere,
        instWhere: signedInstWhere,
        today,
      }),
      this.prisma.contract.count({ where: { signedAt: null, ...LIVE_CONTRACT_WHERE } }),
      // Unsigned contracts whose first payment has already fallen due: nothing
      // chases it (no late fee, no reminder) until someone signs.
      this.prisma.contract.count({
        where: {
          signedAt: null,
          ...LIVE_CONTRACT_WHERE,
          installmentPlan: {
            is: {
              cancelledAt: null,
              installments: {
                some: {
                  status: { in: [InstallmentStatus.PENDING, InstallmentStatus.OVERDUE] },
                  type: { notIn: SURCHARGE_PAYMENT_TYPES },
                  dueDate: { lte: today },
                },
              },
            },
          },
        },
      }),
    ]);

    const [reservationTrend, leadSources, recentActivity, topProjects] = await Promise.all([
      this.reservationTrend(now, tz),
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
        totalContractValue,
        totalCollectedVerified:   Number(totalCollectedVerifiedAgg._sum.amount      ?? 0),
        overdueTotal:             Number(overdueAgg._sum.amount                     ?? 0),
        collectedTowardsPrice:    Number(collectedTowardsPriceAgg._sum.amount       ?? 0),
        overdueTowardsPrice:      Number(overdueTowardsPriceAgg._sum.amount         ?? 0),
        feesCollected:            Number(feesCollectedAgg._sum.amount               ?? 0),
        dueToDate:                Number(dueSplit.due),
        collectedAgainstDue:      Number(dueSplit.collected),
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
      // Signed contracts' value split (paid + awaiting + late + not due yet +
      // not on a schedule = gross value), as on the financial report.
      portfolio: {
        grossValue: Number(split.grossValue),
        netValue: totalContractValue,
        paid: Number(split.paid),
        awaiting: Number(split.awaiting),
        overdue: Number(split.overdue),
        overdueCount: split.overdueCount,
        notYetDue: Number(split.notYetDue),
        unscheduled: Number(split.unscheduled),
        unsignedCount,
      },
      reservationTrend,
      leadSources,
      recentActivity,
      topProjects,
      alerts: {
        contractsAwaitingSignature,
        contractsDueBeforeSigning: unsignedDueCount,
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
    tz: string,
  ): Promise<Array<{ month: string; label: string; value: number }>> {
    const { year, month } = localDate(tz, now);
    const slots = Array.from({ length: 6 }, (_, i) => {
      const m = localMonth(year, month - (5 - i), tz);
      return { start: m.start, end: m.end, month: m.key, label: AR_MONTHS[m.monthIndex]! };
    });
    const counts = await this.prisma.$transaction(
      slots.map((s) =>
        this.prisma.reservation.count({ where: { deletedAt: null, createdAt: { gte: s.start, lt: s.end } } }),
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
    Array<{ id: string; type: string; title: string; action: string; context: string | null; createdAt: Date; amount?: number }>
  > {
    const take = 5;
    const [leads, reservations, contracts, visits, maintenance, deposits, infos] = await Promise.all([
      this.prisma.lead.findMany({
        orderBy: { createdAt: 'desc' },
        take,
        select: { id: true, fullName: true, createdAt: true },
      }),
      this.prisma.reservation.findMany({
        where: { deletedAt: null },
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
      // A payment still standing (not deleted, rejected or reversed).
      this.prisma.deposit.findMany({
        where: RECORDED_DEPOSIT_WHERE,
        orderBy: { createdAt: 'desc' },
        take,
        select: {
          id: true,
          createdAt: true,
          amount: true,
          contract: { select: { contractNumber: true, customer: { select: { fullName: true } } } },
          // A reservation deposit has no contract yet: name and unit come from the reservation.
          reservation: {
            select: {
              reservationNumber: true,
              unit: { select: { code: true } },
              client: { select: { fullName: true } },
              lead: { select: { fullName: true } },
            },
          },
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
      /** Payments only: the amount, so the feed can show it (U5). */
      amount?: number;
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
        title:
          d.contract?.customer?.fullName ??
          d.reservation?.client?.fullName ??
          d.reservation?.lead?.fullName ??
          'عميل',
        action: 'دفعة جديدة',
        context:
          d.contract?.contractNumber ?? d.reservation?.unit?.code ?? d.reservation?.reservationNumber ?? null,
        createdAt: d.createdAt,
        amount: Number(d.amount),
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
      // An archived (sold-out) project still has its sales: it showed 0.
      where: { status: { in: ['PUBLISHED', 'ARCHIVED'] } },
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
                      // Named: a relation read is not scoped by the middleware.
                      where: { companyId: getRequiredCompanyId(), signedAt: { not: null }, ...LIVE_CONTRACT_WHERE },
                      select: { totalAmount: true, markupWaived: true, reservation: { select: MARKUP_SNAPSHOT_SELECT } },
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
        // The net price, without the instalment markup (decided 2026-10-17).
        const contractValue = contracts.reduce(
          (s, c) => s + Number(commissionBasis(c.totalAmount, c.reservation, c.markupWaived)),
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
   * P14.2 + P15.4 — admin dashboard summary as a board-style Arabic XLSX: a
   * branded cover (executive summary + real-alert insights + a reservation-trend
   * bar chart and a lead-source doughnut) plus four detail sheets. Built from the
   * SAME real `adminSummary()` data; no demo values. Charts degrade gracefully —
   * if rendering returns null the tables still ship and the file is never broken.
   */
  async adminSummaryXlsx(): Promise<Buffer> {
    const [s, brand] = await Promise.all([this.adminSummary(), this.brand()]);
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
    // Untitled: each sits under its own section title on the cover.
    const trendChart = await renderBarChartPng({
      width: 720,
      height: 300,
      series: s.reservationTrend.map((t) => ({ label: t.label, value: t.value })),
    });
    const sourcesChart = await renderShareChartPng({
      width: 560,
      height: 300,
      series: s.leadSources.map((l) => ({ label: l.source, value: l.count })),
    });

    // ── Sheet 1: الملخص — polished board cover (P15.4.1) ────────────────────
    const SPAN = 6;
    const sum = wb.addWorksheet('الملخص');
    setupBoardSheet(sum, { widths: [16, 16, 16, 16, 16, 16], landscape: true });
    addBoardBanner(sum, 'تقرير لوحة التحكم', SPAN, { wb, brand });

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
      { span: SPAN, perRow: 3, bg: XLSX_ALERT_BG, emptyText: NO_OPEN_ALERTS },
    );

    addChartBlock(wb, sum, 'اتجاه الحجوزات (آخر 6 أشهر)', trendChart, { span: SPAN, width: 720, height: 300 });
    addChartBlock(wb, sum, 'توزيع مصادر العملاء', sourcesChart, { span: SPAN, width: 560, height: 300 });

    addFooter(sum, brand);

    // ── Detail sheets: titled like every other report (company, time, footer) ──
    const trend = wb.addWorksheet('اتجاهات الحجوزات');
    addTitledTable(trend, {
      title: 'اتجاه الحجوزات (آخر 6 أشهر)',
      headers: ['الشهر', 'اسم الشهر', 'عدد الحجوزات'],
      rows: s.reservationTrend.map((t) => [t.month, t.label, t.value]),
      widths: [14, 20, 16],
      brand,
    });
    const trendTotal = s.reservationTrend.reduce((acc, t) => acc + t.value, 0);
    styleTotalsRow(trend.addRow(['الإجمالي', '', trendTotal]));
    addFooter(trend, brand);

    const lead = wb.addWorksheet('مصادر العملاء');
    const leadTotal = s.leadSources.reduce((acc, l) => acc + l.count, 0);
    addTitledTable(lead, {
      title: 'توزيع مصادر العملاء المحتملين',
      headers: ['المصدر', 'العدد', 'النسبة'],
      rows: s.leadSources.map((l) => [l.source, l.count, leadTotal > 0 ? l.count / leadTotal : 0]),
      widths: [26, 14, 12],
      brand,
    });
    lead.getColumn(3).numFmt = '0%';
    addFooter(lead, brand);

    // Real, non-zero alerts only — the same set as the cover.
    const alertSheet = wb.addWorksheet('التنبيهات');
    addTitledTable(alertSheet, {
      title: 'التنبيهات المعلقة',
      headers: ['التنبيه', 'العدد'],
      rows: alertRows,
      widths: [34, 14],
      brand,
      emptyText: NO_OPEN_ALERTS,
    });
    addFooter(alertSheet, brand);

    // Times in the company's zone (the server runs in UTC).
    const activity = wb.addWorksheet('آخر النشاطات');
    addTitledTable(activity, {
      title: 'آخر النشاطات',
      headers: ['النشاط', 'الجهة', 'السياق', 'التاريخ'],
      rows: s.recentActivity.map((a) => [
        a.action,
        a.title,
        a.context ?? '—',
        excelLocalDate(a.createdAt, brand.timezone),
      ]),
      widths: [18, 26, 18, 18],
      brand,
    });
    activity.getColumn(4).numFmt = 'yyyy-mm-dd hh:mm';
    addFooter(activity, brand);

    return workbookToBuffer(wb);
  }

  async financialDashboard(opts: {
    projectId?: string;
    q?: string;
    type?: DepositType;
    dateFrom?: string;
    dateTo?: string;
    /** The exported report: also the lists (ledger, late payers, …). */
    detail?: boolean;
  }) {
    // Today, this month and the monthly buckets are the company's (its time
    // zone), not UTC's. Calendar dates (dueDate) compare with the UTC
    // midnight of the local date; timestamps (paidAt) with local midnight.
    const tz = await currentCompanyTimeZone(this.prisma, getTenantContext()?.companyId);
    const now = new Date();
    const todayUTC = startOfLocalToday(tz, now);
    const local = localDate(tz, now);
    const thisMonth = localMonth(local.year, local.month, tz);
    const monthStart = thisMonth.startDay;
    const monthEnd = thisMonth.endDay;
    const weekEnd = new Date(
      todayUTC.getTime() + 7 * 24 * 60 * 60 * 1000,
    );
    const in30 = new Date(todayUTC.getTime() + 30 * 24 * 60 * 60 * 1000);
    const in60 = new Date(todayUTC.getTime() + 60 * 24 * 60 * 60 * 1000);
    const in90 = new Date(todayUTC.getTime() + 90 * 24 * 60 * 60 * 1000);

    // ── Installment filter blocks ──────────────────────────────────────────
    // Installments of live contracts only (not cancelled, not deleted).
    // Signed contracts only: an unsigned one has nothing due yet (it is not
    // chased) and is not in the contract value — counting its rows in "due"
    // and "remaining" made the report's figures not add up. It is reported
    // apart (portfolio.unsigned).
    const SIGNED_PLAN_WHERE = {
      ...LIVE_PLAN_WHERE,
      contract: { ...LIVE_CONTRACT_WHERE, signedAt: { not: null } },
    } satisfies Prisma.InstallmentPlanWhereInput;
    const instAnd: Prisma.InstallmentWhereInput[] = [{ plan: SIGNED_PLAN_WHERE }];
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
    // Only payments still standing (not deleted / rejected / reversed).
    const baseDepAnd: Prisma.DepositWhereInput[] = [RECORDED_DEPOSIT_WHERE];
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
          ...reportRange(opts.dateFrom, opts.dateTo, tz),
        },
      });
    }

    // ── Contract filter blocks ─────────────────────────────────────────────
    // Sales figures count live contracts only.
    const contractAnd: Prisma.ContractWhereInput[] = [LIVE_CONTRACT_WHERE];
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

    // Unpaid = PENDING or OVERDUE. Explicit IN avoids silently including
    // InstallmentStatus.CANCELLED (added in Step D1) in outstanding totals.
    // Towards the price: fee and penalty rows are not part of it.
    const unpaid: Prisma.InstallmentWhereInput = {
      status: { in: [InstallmentStatus.PENDING, InstallmentStatus.OVERDUE] },
      type: { notIn: SURCHARGE_PAYMENT_TYPES },
    };
    // Overdue (and its aging) follows the overdue sweep: a signed deal, and
    // no payment on its way — a proof under review or a cheque not cleared
    // is the customer having paid. They counted as overdue here before.
    const overdueUnpaid: Prisma.InstallmentWhereInput = {
      ...unpaid,
      plan: BILLABLE_PLAN_WHERE,
      deposits: { none: PAYMENT_ON_ITS_WAY },
    };
    // ── Run all 13 queries in parallel ────────────────────────────────────
    const [
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
      // Headline: money actually collected (see common/finance/collected.ts).
      this.prisma.deposit.aggregate({
        where: filteredDepWhere(COLLECTED_DEPOSIT_WHERE),
        _sum: { amount: true },
      }),
      // Remaining and overdue are towards the price (fees are their own
      // figure) — one definition with the dashboard.
      this.prisma.installment.aggregate({
        where: instWhere({
          status: { in: [InstallmentStatus.PENDING, InstallmentStatus.OVERDUE] },
          type: { notIn: SURCHARGE_PAYMENT_TYPES },
        }),
        _sum: { amount: true },
      }),
      this.prisma.installment.aggregate({
        where: instWhere({ status: InstallmentStatus.OVERDUE, type: { notIn: SURCHARGE_PAYMENT_TYPES } }),
        _sum: { amount: true },
      }),
      // collectedThisMonth uses baseDepWhere (ignores user date range — always current month)
      this.prisma.deposit.aggregate({
        where: baseDepWhere({ AND: [COLLECTED_DEPOSIT_WHERE, TOWARDS_PRICE_DEPOSIT_WHERE, { paidAt: { gte: thisMonth.start, lt: thisMonth.end } }] }),
        _sum: { amount: true },
      }),
      // Everything falling due this month, paid or not (as the trend's bar):
      // counting only what is still open made it shrink as it got paid.
      this.prisma.installment.aggregate({
        where: instWhere({
          dueDate: { gte: monthStart, lt: monthEnd },
          status: { not: InstallmentStatus.CANCELLED },
          type: { notIn: SURCHARGE_PAYMENT_TYPES },
        }),
        _sum: { amount: true },
      }),
      // ── KPI counts ──
      this.prisma.contract.count({ where: { AND: [contractWhere, { signedAt: { not: null } }] } }),
      this.prisma.deposit.count({ where: filteredDepWhere() }),
      this.prisma.installment.count({
        where: instWhere({ status: InstallmentStatus.OVERDUE }),
      }),
      // ── Overdue table ──
      // The same rows as the late figure and its aging (past their due day,
      // no payment on its way) — it listed the rows the nightly sweep had
      // marked, one short of the count above it the day after a due date.
      this.prisma.installment.findMany({
        where: instWhere({ ...overdueUnpaid, dueDate: { lt: todayUTC } }),
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
          deletedAt: true,
          reviewStatus: true,
          ...DEPOSIT_STATE_SELECT,
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
          ...reportRange(opts.dateFrom, opts.dateTo, tz),
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
      deletedAt: null,
      ...(opts.projectId
        ? { unit: { building: { phase: { projectId: opts.projectId } } } }
        : {}),
    });

    const agingWhere = (range: Prisma.DateTimeFilter<'Installment'>): Prisma.InstallmentWhereInput =>
      instWhere({ ...overdueUnpaid, dueDate: range });

    const [
      recordedAgg,
      byTypeGroups,
      byTypeCollectedGroups,
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
      unpaidBookingAgg,
    ] = await Promise.all([
      // Recorded (collected + waiting) vs collected, overall and per type.
      this.prisma.deposit.aggregate({ where: filteredDepWhere(), _sum: { amount: true } }),
      this.prisma.deposit.groupBy({
        by: ['type'],
        where: filteredDepWhere(AWAITING_DEPOSIT_WHERE),
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.deposit.groupBy({
        by: ['type'],
        where: filteredDepWhere(COLLECTED_DEPOSIT_WHERE),
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.installment.aggregate({ where: instWhere(unpaid), _sum: { amount: true } }),
      this.prisma.installment.aggregate({
        where: instWhere({ ...unpaid, dueDate: { gte: todayUTC, lt: weekEnd } }),
        _sum: { amount: true },
      }),
      this.prisma.installment.aggregate({
        where: instWhere({ ...overdueUnpaid, dueDate: { lt: todayUTC } }),
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
      this.prisma.deposit.aggregate({ where: bookingDepWhere(COLLECTED_DEPOSIT_WHERE), _sum: { amount: true } }),
      this.prisma.deposit.aggregate({ where: bookingDepWhere(RECORDED_DEPOSIT_WHERE), _sum: { amount: true } }),
      this.prisma.reservation.aggregate({
        where: {
          AND: [
            { OR: [resvWhere(ReservationStatus.PENDING), resvWhere(ReservationStatus.APPROVED)] },
            { deletedAt: null, bookingPaymentStatus: { notIn: [ReservationBookingPaymentStatus.PAID, ReservationBookingPaymentStatus.WAIVED] } },
          ],
        },
        _sum: { bookingAmount: true },
      }),
    ]);

    // Decimal-safe coercion for money arithmetic (aggregates are Decimal in
    // prod; this also tolerates number/string inputs).
    const D = (v: Prisma.Decimal | number | string | null | undefined) =>
      new Prisma.Decimal(v ?? 0);

    // Collection: verified-only is the bankable headline; all/unverified kept too.
    // "verified" = collected; "all" = recorded and still standing; the gap is
    // money waiting (proof under review, cheque not cleared yet).
    // Decided 2026-10-16: collected as two figures — towards the price (the
    // collection rate is this over the contracts' value, as on the dashboard)
    // and fees & penalties.
    const [towardsPriceAgg, feesCollectedAgg] = await Promise.all([
      this.prisma.deposit.aggregate({
        where: filteredDepWhere({ AND: [COLLECTED_DEPOSIT_WHERE, TOWARDS_PRICE_DEPOSIT_WHERE] }),
        _sum: { amount: true },
      }),
      this.prisma.deposit.aggregate({
        where: filteredDepWhere({ AND: [COLLECTED_DEPOSIT_WHERE, FEES_DEPOSIT_WHERE] }),
        _sum: { amount: true },
      }),
    ]);
    // Decisions of 2026-10-17: contract value is signed contracts at their net
    // price; the collection rate is collected against what is due by today
    // (the booking and the rows due up to today), as on the dashboard.
    // The company named, as on the dashboard: relation filters are not scoped.
    const signedContractWhere: Prisma.ContractWhereInput = {
      AND: [contractWhere, { signedAt: { not: null }, companyId: getRequiredCompanyId() }],
    };
    const [totalContractValue, dueSplit] = await Promise.all([
      netContractValue(this.prisma, signedContractWhere),
      dueToDateSplit(this.prisma, { signedContractWhere, instWhere, today: todayUTC }),
    ]);
    const dueToDate = dueSplit.due;
    const collectedAgainstDue = dueSplit.collected;
    const collectedAll = D(recordedAgg._sum.amount);
    const collectedVerified = D(totalCollectedAgg._sum.amount);
    // On its way (proof to review / cheque not cleared) — not "recorded minus
    // collected", which also held bounced cheques.
    const collectedUnverified = byTypeGroups.reduce((a, g) => a.plus(D(g._sum.amount)), zero);

    // Per-DepositType breakdown (respects active filters, incl. the user type
    // filter if set): collected, and on its way (proof to review / cheque not
    // cleared). Rejected, bounced and reversed payments are in neither.
    type TypeAcc = { count: number; collected: Prisma.Decimal; awaiting: Prisma.Decimal };
    const byType = new Map<DepositType, TypeAcc>();
    for (const t of Object.values(DepositType)) {
      byType.set(t, { count: 0, collected: zero, awaiting: zero });
    }
    for (const g of byTypeGroups) {
      const acc = byType.get(g.type);
      if (!acc) continue;
      acc.count += g._count?._all ?? 0;
      acc.awaiting = acc.awaiting.plus(D(g._sum.amount));
    }
    for (const g of byTypeCollectedGroups) {
      const acc = byType.get(g.type);
      if (!acc) continue;
      acc.count += g._count?._all ?? 0;
      acc.collected = acc.collected.plus(D(g._sum.amount));
    }
    const collectionByType = Object.values(DepositType).map((t) => {
      const acc = byType.get(t)!;
      return {
        type: t,
        count: acc.count,
        totalAll: acc.collected.plus(acc.awaiting).toString(),
        totalCollected: acc.collected.toString(),
        totalAwaiting: acc.awaiting.toString(),
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
    // Bookings of active reservations not paid yet (it subtracted every
    // booking ever collected, converted ones included, so it read 0).
    const bookingUncollectedEstimate = D(unpaidBookingAgg._sum.bookingAmount);
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
              ...reportRange(opts.dateFrom, opts.dateTo, tz),
            },
          }
        : {};

    // Owed and payable are on a deal still payable (or kept with RETAIN): a
    // deal cancelled with MANUAL left its commission APPROVED, and it was
    // counted as a liability no report or payout would ever pay.
    const payableBonus: Prisma.BonusEntryWhereInput = {
      OR: [{ contractId: null }, { contract: LIVE_CONTRACT_WHERE }, { retainedOnCancellation: true }],
    };
    const bonusWhere = (status: BonusEntryStatus): Prisma.BonusEntryWhereInput => ({
      status,
      ...dateRange('createdAt'),
      ...(status === BonusEntryStatus.PAID ? {} : payableBonus),
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
      AND: [PAYABLE_DEAL_WHERE, { OR: [{ payoutId: null }, { payout: { status: { not: BrokerPayoutStatus.PAID } } }] }],
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
      this.prisma.brokerCommission.aggregate({ where: bcWhere({ status: BrokerCommissionStatus.PENDING, ...PAYABLE_DEAL_WHERE }), _sum: { netAmount: true }, _count: { _all: true } }),
      this.prisma.brokerCommission.aggregate({ where: bcWhere({ status: BrokerCommissionStatus.APPROVED, ...PAYABLE_DEAL_WHERE }), _sum: { netAmount: true }, _count: { _all: true } }),
      this.prisma.brokerCommission.aggregate({ where: bcWhere(bcPaidStatus), _sum: { netAmount: true }, _count: { _all: true } }),
      this.prisma.brokerCommission.aggregate({ where: bcWhere(bcUnpaidStatus), _sum: { netAmount: true }, _count: { _all: true } }),
      this.prisma.brokerPayout.groupBy({
        by: ['status'],
        where: dateRange('createdAt'),
        _sum: { totalNet: true },
        _count: { _all: true },
      }),
    ]);

    // Clawbacks still owed back to the company (a cancelled deal whose
    // commission or bonus was already paid): what each recovers less what was
    // collected, by hand or netted into a paid payout. They are money owed
    // *to* the company, so they stay out of totalUnpaidLiabilities — but they
    // were on no report, and the paid lines kept counting them as paid out.
    const owedStatus = { in: [ClawbackStatus.OUTSTANDING, ClawbackStatus.PARTIALLY_COLLECTED] };
    const clawbackRange = dateRange('createdAt').createdAt
      ? { clawbackAt: dateRange('createdAt').createdAt }
      : {};
    const [bcClawbacks, bonusClawbacks] = await Promise.all([
      this.prisma.brokerCommission.findMany({
        where: {
          clawbackStatus: owedStatus,
          ...(opts.projectId ? { projectId: opts.projectId } : {}),
          ...clawbackRange,
        },
        select: { netAmount: true, clawbackAmount: true, clawbackCollectedAmount: true },
      }),
      this.prisma.bonusEntry.findMany({
        where: { clawbackStatus: owedStatus, ...clawbackRange },
        select: { amount: true, clawbackAmount: true, clawbackCollectedAmount: true },
      }),
    ]);
    const stillOwed = (rows: Array<{ full: Prisma.Decimal; collected: Prisma.Decimal | null }>) =>
      rows.reduce((sum, r) => {
        const left = r.full.sub(r.collected ?? zero);
        return left.isPositive() ? sum.plus(left) : sum;
      }, zero);
    const bcClawbackOwed = stillOwed(
      bcClawbacks.map((c) => ({ full: c.clawbackAmount ?? c.netAmount, collected: c.clawbackCollectedAmount })),
    );
    const bonusClawbackOwed = stillOwed(
      bonusClawbacks.map((b) => ({ full: b.clawbackAmount ?? b.amount, collected: b.clawbackCollectedAmount })),
    );

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
      clawbacksOwed: {
        brokerCommissionsAmount: bcClawbackOwed.toString(),
        brokerCommissionsCount: bcClawbacks.length,
        salesBonusAmount: bonusClawbackOwed.toString(),
        salesBonusCount: bonusClawbacks.length,
        totalAmount: bcClawbackOwed.plus(bonusClawbackOwed).toString(),
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
      ...reportRange(opts.dateFrom, opts.dateTo, tz),
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
                  ...reportRange(opts.dateFrom, opts.dateTo, tz),
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
    // The company's last 6 months: payments by local midnight, dues by date.
    const trendSlots = Array.from({ length: 6 }, (_, i) => {
      const m = localMonth(local.year, local.month - 5 + i, tz);
      return {
        start: m.start,
        end: m.end,
        startDay: m.startDay,
        endDay: m.endDay,
        month: m.key,
        label: new Intl.DateTimeFormat('ar-EG', { month: 'short', timeZone: 'UTC' }).format(m.startDay),
      };
    });

    const [trendCollected, trendDue] = await Promise.all([
      Promise.all(
        trendSlots.map(({ start, end }) =>
          this.prisma.deposit.aggregate({
            // Towards the price, against what fell due (fees out of both).
            where: baseDepWhere({ AND: [COLLECTED_DEPOSIT_WHERE, TOWARDS_PRICE_DEPOSIT_WHERE, { paidAt: { gte: start, lt: end } }] }),
            _sum: { amount: true },
          }),
        ),
      ),
      Promise.all(
        trendSlots.map(({ startDay, endDay }) =>
          this.prisma.installment.aggregate({
            // Due = everything that fell due that month, paid or not — but not
            // what was cancelled.
            where: instWhere({
              dueDate: { gte: startDay, lt: endDay },
              status: { not: InstallmentStatus.CANCELLED },
              type: { notIn: SURCHARGE_PAYMENT_TYPES },
            }),
            _sum: { amount: true },
          }),
        ),
      ),
    ]);

    // ── Portfolio: where the signed contracts' value stands today ───────────
    // Lifetime (the period filter does not apply) and on one base, so the
    // parts add up to the value: paid + awaiting confirmation + late + not
    // due yet + not on the schedule = the signed contracts' total (with the
    // instalment markup, which is shown apart). It mixed the period's
    // collections with lifetime totals and read "collected 2.6%, not due
    // 102%".
    const onItsWay: Prisma.InstallmentWhereInput = { ...unpaid, deposits: { some: PAYMENT_ON_ITS_WAY } };
    const unsignedContractWhere: Prisma.ContractWhereInput = { AND: [contractWhere, { signedAt: null }] };
    const [split, unsignedCount, unsignedOpenAgg, monthRows, unsignedRows, paidEarlyAgg, cashInOnMonthAgg] =
      await Promise.all([
        portfolioSplit(this.prisma, { signedContractWhere, instWhere, today: todayUTC }),
        this.prisma.contract.count({ where: unsignedContractWhere }),
        this.prisma.installment.aggregate({
          where: {
            AND: [
              ...instAnd.slice(1),
              { plan: { ...LIVE_PLAN_WHERE, contract: { ...LIVE_CONTRACT_WHERE, signedAt: null } } },
              unpaid,
            ],
          },
          _sum: { amount: true },
        }),
        // This month's rows: paid / on its way / late / still to come.
        Promise.all([
          { status: InstallmentStatus.PAID },
          onItsWay,
          { ...overdueUnpaid, dueDate: { lt: todayUTC } },
          { ...overdueUnpaid, dueDate: { gte: todayUTC } },
        ].map((w) =>
          this.prisma.installment.aggregate({
            where: instWhere({
              AND: [w, { dueDate: { gte: monthStart, lt: monthEnd }, type: { notIn: SURCHARGE_PAYMENT_TYPES } }],
            }),
            _sum: { amount: true },
          }),
        )),
        // Unsigned contracts and what their schedule asks first: their down
        // payment can fall due before anyone signs, and nothing chases it.
        this.prisma.contract.findMany({
          where: unsignedContractWhere,
          orderBy: { createdAt: 'asc' },
          take: 20,
          select: {
            id: true,
            contractNumber: true,
            createdAt: true,
            totalAmount: true,
            customer: { select: { id: true, fullName: true } },
            unit: { select: { id: true, code: true } },
            installmentPlan: {
              select: {
                installments: {
                  where: unpaid,
                  orderBy: { dueDate: 'asc' },
                  take: 1,
                  select: { id: true, type: true, amount: true, dueDate: true },
                },
              },
            },
          },
        }),
        // "Paid" this month counts this month's rows however early they were
        // paid; "cash in" counts this month's money whatever row it paid.
        // These two say how far apart they are and why.
        this.prisma.installment.aggregate({
          where: instWhere({
            status: InstallmentStatus.PAID,
            type: { notIn: SURCHARGE_PAYMENT_TYPES },
            dueDate: { gte: monthStart, lt: monthEnd },
            paidAt: { lt: thisMonth.start },
          }),
          _sum: { amount: true },
        }),
        this.prisma.deposit.aggregate({
          where: baseDepWhere({
            AND: [
              COLLECTED_DEPOSIT_WHERE,
              TOWARDS_PRICE_DEPOSIT_WHERE,
              { paidAt: { gte: thisMonth.start, lt: thisMonth.end } },
              { installment: { is: { dueDate: { gte: monthStart, lt: monthEnd } } } },
            ],
          }),
          _sum: { amount: true },
        }),
      ]);
    const net = new Prisma.Decimal(totalContractValue).toDecimalPlaces(2);
    const portfolio = {
      grossValue: split.grossValue.toString(),
      netValue: net.toString(),
      markup: Prisma.Decimal.max(zero, split.grossValue.minus(net)).toString(),
      paid: split.paid.toString(),
      awaiting: split.awaiting.toString(),
      overdue: split.overdue.toString(),
      notYetDue: split.notYetDue.toString(),
      unscheduled: split.unscheduled.toString(),
      unsigned: {
        count: unsignedCount,
        open: D(unsignedOpenAgg._sum.amount).toString(),
        contracts: unsignedRows.map(({ installmentPlan, ...c }) => ({
          ...c,
          totalAmount: c.totalAmount.toString(),
          firstDue: installmentPlan?.installments[0]
            ? { ...installmentPlan.installments[0], amount: installmentPlan.installments[0].amount.toString() }
            : null,
        })),
      },
    };
    const [mPaid, mAwaiting, mLate, mUpcoming] = monthRows.map((a) => D(a._sum.amount).toString());
    const month = {
      due: (dueThisMonthAgg._sum.amount ?? zero).toString(),
      paid: mPaid!,
      awaiting: mAwaiting!,
      overdue: mLate!,
      upcoming: mUpcoming!,
      // Money that came in this month, whatever it paid (earlier rows, the
      // booking) — not comparable with "due this month".
      cashIn: (collectedThisMonthAgg._sum.amount ?? zero).toString(),
      /** Of "paid": rows paid before the month began. */
      paidEarly: D(paidEarlyAgg._sum.amount).toString(),
      /** Of "cash in": money for other rows — earlier months, the booking, ahead. */
      cashInOther: Prisma.Decimal.max(
        zero,
        D(collectedThisMonthAgg._sum.amount).minus(D(cashInOnMonthAgg._sum.amount)),
      ).toString(),
    };

    // ── Refunds on cancelled contracts (money going back out) ────────────────
    // Same project / customer filters, but cancelled contracts are exactly
    // the ones that matter here, so LIVE_CONTRACT_WHERE is not applied.
    const refundContractAnd: Prisma.ContractWhereInput[] = contractAnd.filter(
      (c) => c !== LIVE_CONTRACT_WHERE,
    );
    const refundContract: Prisma.ContractWhereInput =
      refundContractAnd.length > 0 ? { AND: refundContractAnd } : {};
    const [refundsPaidAgg, refundsPaidAllAgg, refundsAgreedAgg] = await Promise.all([
      this.prisma.refund.aggregate({
        where: {
          cancellation: { contract: refundContract },
          ...(opts.dateFrom || opts.dateTo
            ? {
                paidAt: {
                  ...reportRange(opts.dateFrom, opts.dateTo, tz),
                },
              }
            : {}),
        },
        _sum: { amount: true },
      }),
      this.prisma.refund.aggregate({
        where: { cancellation: { contract: refundContract } },
        _sum: { amount: true },
      }),
      this.prisma.contractCancellation.aggregate({
        where: { contract: refundContract },
        _sum: { refundAmount: true },
      }),
    ]);
    const refundsPaid = D(refundsPaidAgg._sum.amount);
    const refundsOwedRaw = D(refundsAgreedAgg._sum.refundAmount).minus(D(refundsPaidAllAgg._sum.amount));
    const refundsOwed = refundsOwedRaw.lessThan(0) ? zero : refundsOwedRaw;
    // A refund is not of any payment type: filtered by type (e.g. fees), the
    // figure is that type's money, with no refund taken off — it used to
    // subtract every refund of the period from, say, the fees collected.
    const netCollected = opts.type ? collectedVerified : collectedVerified.minus(refundsPaid);

    // ── The exported report's lists, on the report's own filters ─────────────
    // Ledger: the payments the figures count (recorded, in the period).
    // Late: the rows of the late figure. Next 30 days: rows towards the price
    // falling due in [today, today+30). Cheques: those of the period's
    // payments (bounced ones too, which the ledger leaves out).
    const detail = opts.detail
      ? await this.financialDetailRows({
          ledgerWhere: filteredDepWhere(),
          lateWhere: instWhere({ ...overdueUnpaid, dueDate: { lt: todayUTC } }),
          next30Where: instWhere({ ...unpaid, dueDate: { gte: todayUTC, lt: in30 } }),
          chequeDepositWhere: {
            AND: [
              { deletedAt: null },
              ...baseDepAnd.slice(1),
              ...(opts.dateFrom || opts.dateTo ? [{ paidAt: reportRange(opts.dateFrom, opts.dateTo, tz) }] : []),
            ],
          },
          today: todayUTC,
        })
      : undefined;

    const cashflowTrend = trendSlots.map(({ month, label }, i) => ({
      month,
      label,
      collected: Number(trendCollected[i]?._sum.amount ?? 0),
      due: Number(trendDue[i]?._sum.amount ?? 0),
    }));

    return {
      summary: {
        totalContractValue: new Prisma.Decimal(totalContractValue).toDecimalPlaces(2).toString(),
        dueToDate: dueToDate.toString(),
        collectedAgainstDue: collectedAgainstDue.toString(),
        // Money collected (common/finance/collected.ts) — same as
        // totalCollectedVerified; totalCollectedAll is everything recorded.
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
        collectedTowardsPrice: D(towardsPriceAgg._sum.amount).toString(),
        feesCollected: D(feesCollectedAgg._sum.amount).toString(),
        // Refunds: paid back in the period, still owed, and collected net of
        // what was paid back.
        refundsPaid: refundsPaid.toString(),
        refundsOwed: refundsOwed.toString(),
        netCollected: netCollected.toString(),
        totalOutstanding: (outstandingAgg._sum.amount ?? zero).toString(),
        dueSoonAmount: (dueSoonAgg._sum.amount ?? zero).toString(),
        overdueAmountComputed: (overdueComputedAgg._sum.amount ?? zero).toString(),
        overdueInstallmentCountComputed: overdueComputedAgg._count?._all ?? 0,
      },
      portfolio,
      month,
      collectionByType,
      aging,
      booking,
      liabilities,
      documentsHealth,
      overdue: overdueRows,
      upcomingThisWeek: upcomingWeekRows,
      upcomingThisMonth: upcomingMonthRows,
      recentDeposits: recentDeposits.map(withDepositState),
      cashflowTrend,
      cashflowForecast: {
        next30:   Number(forecast30Agg._sum.amount   ?? 0),
        next3160: Number(forecast3160Agg._sum.amount ?? 0),
        next6190: Number(forecast6190Agg._sum.amount ?? 0),
      },
      ...(detail ? { detail } : {}),
    };
  }

  /** The rows behind the exported financial report (see financial-detail.ts). */
  private async financialDetailRows(w: {
    ledgerWhere: Prisma.DepositWhereInput;
    lateWhere: Prisma.InstallmentWhereInput;
    next30Where: Prisma.InstallmentWhereInput;
    chequeDepositWhere: Prisma.DepositWhereInput;
    today: Date;
  }) {
    const take = DETAIL_LIMIT + 1;
    const unit = {
      select: {
        code: true,
        building: { select: { phase: { select: { project: { select: { id: true, name: true } } } } } },
      },
    } as const;
    const party = { select: { fullName: true } } as const;
    const contractRef = {
      select: {
        id: true,
        contractNumber: true,
        customer: { select: { fullName: true, phone: true } },
        unit: { select: { code: true } },
      },
    } as const;
    const [deposits, late, next30, cheques] = await Promise.all([
      this.prisma.deposit.findMany({
        where: w.ledgerWhere,
        orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }],
        take,
        select: {
          type: true,
          amount: true,
          paidAt: true,
          paymentMethod: true,
          deletedAt: true,
          reviewStatus: true,
          ...DEPOSIT_STATE_SELECT,
          contract: { select: { contractNumber: true, customer: party, unit } },
          reservation: { select: { reservationNumber: true, client: party, lead: party, unit } },
        },
      }),
      this.prisma.installment.findMany({
        where: w.lateWhere,
        orderBy: { dueDate: 'asc' },
        take,
        select: { type: true, dueDate: true, amount: true, plan: { select: { contract: contractRef } } },
      }),
      this.prisma.installment.findMany({
        where: w.next30Where,
        orderBy: { dueDate: 'asc' },
        take,
        select: {
          type: true,
          dueDate: true,
          amount: true,
          deposits: { where: PAYMENT_ON_ITS_WAY, select: { id: true }, take: 1 },
          plan: { select: { contract: contractRef } },
        },
      }),
      this.prisma.paymentInstrument.findMany({
        where: {
          companyId: getRequiredCompanyId(),
          type: PaymentInstrumentType.CHEQUE,
          deposits: { some: w.chequeDepositWhere },
        },
        orderBy: [{ chequeDueDate: 'asc' }, { createdAt: 'asc' }],
        take,
        select: {
          chequeNumber: true,
          drawerBankName: true,
          chequeDueDate: true,
          status: true,
          deposits: {
            where: w.chequeDepositWhere,
            select: {
              amount: true,
              contract: { select: { contractNumber: true, customer: party, unit: { select: { code: true } } } },
              reservation: {
                select: {
                  reservationNumber: true,
                  client: party,
                  lead: party,
                  unit: { select: { code: true } },
                },
              },
            },
          },
        },
      }),
    ]);
    return buildFinancialDetail({
      deposits,
      late,
      next30,
      cheques,
      today: w.today,
      projectName: translatableAr,
    });
  }

  // ── CSV builders ─────────────────────────────────────────────────────────
  // Each builder takes the already-computed report payload and emits a CSV
  // string with a UTF-8 BOM (Excel-friendly Arabic). Reuses the service's
  // existing data methods — no new business logic.

  /**
   * P15.4 — sales as a board-style XLSX: branded cover with an executive summary
   * (lead/visit/contract/sales KPIs), a sales-by-project bar chart, and a detail
   * sheet. Same real `sales()` + `kpis()` data as the CSV; project names resolved
   * for the chart/table. Chart degrades gracefully to tables-only on failure.
   */
  async salesBoardXlsx(period?: string, dateFrom?: string, dateTo?: string): Promise<Buffer> {
    const data = await this.sales(period, dateFrom, dateTo);

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
      width: 720,
      height: 320,
      series: byProject.slice(0, 8).map((p) => ({ label: p.name, value: p.total })),
    });

    const brand = await this.brand();
    const currency = brand.currency;
    const SPAN = 6;
    const wb = createReportWorkbook();
    const cover = wb.addWorksheet('الملخص');
    setupBoardSheet(cover, { widths: [16, 16, 16, 16, 16, 16], landscape: true });
    addBoardBanner(cover, 'تقرير المبيعات', SPAN, { wb, brand });
    addSectionTitle(cover, 'الملخص التنفيذي', SPAN);
    addKpiCards(
      cover,
      [
        // The period's figures only (all-time lead counts sat beside them).
        { label: 'الفترة', value: reportPeriodLabel(period, dateFrom, dateTo) },
        { label: 'عدد العقود', value: data.contracts },
        { label: 'إجمالي المبيعات (السعر الصافي)', value: Number(data.total), currency },
      ],
      { span: SPAN, perRow: 3 },
    );
    addChartBlock(wb, cover, 'المبيعات حسب المشروع', projectChart, { span: SPAN, width: 720, height: 320 });
    addFooter(cover, brand);

    const detail = wb.addWorksheet('المبيعات حسب المشروع');
    addTable(
      detail,
      ['المشروع', 'عدد العقود', 'إجمالي القيمة'],
      byProject.map((p) => [p.name, p.count, p.total]),
      [30, 14, 18],
    );
    formatMoneyColumns(detail, [3], currency);

    return workbookToBuffer(wb);
  }

  /**
   * P15.3 — styled XLSX twin of operationalCsv. Same two real reads (KPIs +
   * reservation breakdown), one sheet per table. No demo values.
   */
  async operationalXlsx(): Promise<Buffer> {
    const [k, r, brand] = await Promise.all([this.kpis(), this.reservations(), this.brand()]);
    const currency = brand.currency;
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
      currency,
      brand,
    });
    kpiSheet.getColumn(2).numFmt = '#,##0.##';
    // The last row (collected deposits) is the one amount among the counts.
    kpiSheet.getCell(kpiSheet.rowCount, 2).numFmt = amountFormat(currency, '0.##');
    addFooter(kpiSheet, brand);

    const resSheet = wb.addWorksheet('الحجوزات حسب الحالة');
    addTable(
      resSheet,
      ['حالة الحجز', 'العدد'],
      Object.entries(r).map(([status, count]) => [status, Number(count)]),
      [26, 14],
    );

    return workbookToBuffer(wb);
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
    const data = await this.financialDashboard({ ...opts, detail: true });
    const s = data.summary;
    const DEP_TYPE_LABEL: Record<string, string> = {
      BOOKING_AMOUNT: 'مبلغ الحجز',
      DOWN_PAYMENT: 'دفعة أولى',
      INSTALLMENT: 'قسط شهري',
      FINAL_PAYMENT: 'دفعة أخيرة',
      FEE: 'رسوم وغرامات',
    };
    const AGING_LABEL: Record<string, string> = {
      '1-30': '1-30 يوم', '31-60': '31-60 يوم', '61-90': '61-90 يوم', '90+': '90+ يوم',
    };

    const agingChart = await renderBarChartPng({
      width: 720,
      height: 300,
      series: data.aging.map((a) => ({ label: AGING_LABEL[a.label] ?? a.label, value: Number(a.amount) })),
    });
    const typeChart = await renderShareChartPng({
      width: 560,
      height: 300,
      series: data.collectionByType.map((c) => ({ label: DEP_TYPE_LABEL[c.type] ?? c.type, value: Number(c.totalAll) })),
    });

    const brand = await this.brand();
    const currency = brand.currency;
    const SPAN = 6;
    const wb = createReportWorkbook();
    const cover = wb.addWorksheet('الملخص');
    setupBoardSheet(cover, { widths: [16, 16, 16, 16, 16, 16], landscape: true });
    addBoardBanner(cover, 'التقرير المالي', SPAN, { wb, brand });

    addSectionTitle(cover, 'الملخص التنفيذي', SPAN);
    addKpiCards(
      cover,
      [
        { label: 'قيمة العقود الموقّعة', value: Number(s.totalContractValue), currency },
        { label: 'المحصّل من السعر', value: Number(s.collectedTowardsPrice), currency },
        { label: 'الرسوم والغرامات', value: Number(s.feesCollected), currency },
        { label: 'بانتظار التأكيد (إيصال/شيك)', value: Number(s.totalCollectedUnverified), currency },
        { label: 'المتبقي للتحصيل', value: Number(s.totalOutstanding), currency },
        { label: 'المحصّل هذا الشهر', value: Number(s.collectedThisMonth), currency },
        { label: 'المستحق هذا الشهر', value: Number(s.dueThisMonth), currency },
        { label: 'صافي النقدية (كل المحصّل − المسترد)', value: Number(s.netCollected), currency },
        { label: 'المستردات المستحقة للعملاء', value: Number(s.refundsOwed), currency },
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
      // Every alert is an amount except the overdue installment count.
      alertCards.map(([label, value]) => ({
        label,
        value,
        currency: label === 'عدد الأقساط المتأخرة' ? undefined : currency,
      })),
      { span: SPAN, perRow: 3, bg: XLSX_ALERT_BG },
    );

    addChartBlock(wb, cover, 'أعمار المتأخرات', agingChart, { span: SPAN, width: 720, height: 300 });
    addChartBlock(wb, cover, 'التحصيل حسب نوع الدفعة', typeChart, { span: SPAN, width: 560, height: 300 });
    addFooter(cover, brand);

    const byType = wb.addWorksheet('التحصيل حسب النوع');
    addTable(
      byType,
      ['النوع', 'العدد', 'الإجمالي', 'تم التحصيل', 'بانتظار التأكيد (إيصال/شيك)'],
      data.collectionByType.map((c) => [
        DEP_TYPE_LABEL[c.type] ?? c.type, c.count,
        Number(c.totalAll), Number(c.totalCollected), Number(c.totalAwaiting),
      ]),
      [20, 12, 16, 16, 16],
    );
    formatMoneyColumns(byType, [3, 4, 5], currency);

    const aging = wb.addWorksheet('أعمار المتأخرات');
    addTable(
      aging,
      ['الفئة', 'العدد', 'المبلغ'],
      data.aging.map((a) => [AGING_LABEL[a.label] ?? a.label, a.count, Number(a.amount)]),
      [18, 12, 18],
    );
    formatMoneyColumns(aging, [3], currency);

    const project = opts.projectId
      ? await this.prisma.project.findFirst({
          where: { id: opts.projectId, companyId: getRequiredCompanyId() },
          select: { name: true },
        })
      : null;
    this.addFinancialDetailSheets(wb, data, {
      brand,
      filters: financialFilterPairs(opts, project && translatableAr(project.name)),
    });

    return workbookToBuffer(wb);
  }

  /** The financial report's lists as sheets, each in the document look. */
  private addFinancialDetailSheets(
    wb: ReturnType<typeof createReportWorkbook>,
    data: Awaited<ReturnType<ReportsService['financialDashboard']>>,
    ctx: { brand: ReportBrand; filters: Array<[string, string]> },
  ): void {
    const { brand, filters } = ctx;
    const currency = brand.currency;
    const x = data.detail;
    if (!x) return;
    const sheet = (
      name: string,
      opts: Omit<Parameters<typeof addTitledTable>[1], 'brand' | 'currency' | 'filters'>,
      money: number[],
      dates: number[] = [],
    ) => {
      const ws = wb.addWorksheet(name);
      addTitledTable(ws, { ...opts, brand, currency, filters });
      formatMoneyColumns(ws, money, currency);
      for (const col of dates) ws.getColumn(col).numFmt = 'yyyy-mm-dd';
      addFooter(ws, brand);
      return ws;
    };
    const sum = <T>(rows: T[], f: (r: T) => number) => rows.reduce((a, r) => a + f(r), 0);
    const share = (part: number, whole: number) => (whole > 0 ? part / whole : 0);
    const limitNote = (truncated: boolean) =>
      truncated ? ` (أول ${DETAIL_LIMIT.toLocaleString('en-US')} سجل)` : '';

    const trend = data.cashflowTrend;
    const tDue = sum(trend, (t) => t.due);
    const tGot = sum(trend, (t) => t.collected);
    const trendWs = sheet(
      'التحصيل الشهري',
      {
        title: 'التحصيل الشهري: المستحق مقابل المحصّل (آخر 6 أشهر)',
        headers: ['الشهر', 'المستحق', 'المحصّل', 'الفرق', 'نسبة التحصيل'],
        rows: trend.map((t) => [`${t.label} ${t.month.slice(0, 4)}`, t.due, t.collected, t.due - t.collected, share(t.collected, t.due)]),
        widths: [18, 18, 18, 18, 14],
        numeric: [2, 3, 4, 5],
        totals: ['الإجمالي', tDue, tGot, tDue - tGot, share(tGot, tDue)],
      },
      [2, 3, 4],
    );
    trendWs.getColumn(5).numFmt = '0%';

    for (const [name, title, first, rows] of [
      ['حسب المشروع', 'التحصيل حسب المشروع', 'المشروع', x.byProject],
      ['حسب طريقة الدفع', 'التحصيل حسب طريقة الدفع', 'طريقة الدفع', x.byMethod],
    ] as const) {
      const ws = sheet(
        name,
        {
          title,
          headers: [first, 'عدد الدفعات', 'تم التحصيل', 'بانتظار التأكيد', 'النسبة من المحصّل'],
          rows: rows.map((r) => [r.name, r.count, r.collected, r.awaiting, share(r.collected, x.ledgerCollected)]),
          widths: [28, 14, 18, 18, 16],
          numeric: [2, 3, 4, 5],
          totals: ['الإجمالي', sum(rows, (r) => r.count), x.ledgerCollected, x.ledgerAwaiting, x.ledgerCollected > 0 ? 1 : 0],
          emptyText: 'لا توجد دفعات في الفترة',
        },
        [3, 4],
      );
      ws.getColumn(5).numFmt = '0%';
    }

    sheet(
      'المتأخرون',
      {
        title: `المتأخرون عن السداد${limitNote(x.lateTruncated)}`,
        headers: ['العميل', 'الهاتف', 'الوحدة', 'العقد', 'أقساط متأخرة', 'أقدم استحقاق', 'أيام التأخير', 'المبلغ المتأخر'],
        rows: x.latePayers.map((r) => [r.customer, r.phone || '—', r.unit, r.contract, r.count, r.oldestDue, r.daysLate, r.amount]),
        widths: [26, 16, 16, 16, 12, 14, 12, 18],
        numeric: [2, 5, 6, 7, 8],
        totals: ['الإجمالي', null, null, null, sum(x.latePayers, (r) => r.count), null, null, sum(x.latePayers, (r) => r.amount)],
        emptyText: 'لا يوجد متأخرون',
      },
      [8],
      [6],
    );

    sheet(
      'المستحق خلال 30 يوم',
      {
        title: `المستحق خلال 30 يومًا${limitNote(x.next30Truncated)}`,
        headers: ['تاريخ الاستحقاق', 'العميل', 'الهاتف', 'الوحدة', 'العقد', 'البند', 'المبلغ', 'ملاحظة'],
        rows: x.next30.map((r) => [r.dueDate, r.customer, r.phone || '—', r.unit, r.contract, r.type, r.amount, r.onItsWay ? 'دفعة بانتظار التأكيد' : '']),
        widths: [14, 26, 16, 16, 16, 14, 18, 20],
        numeric: [1, 3, 7],
        totals: ['الإجمالي', null, null, null, null, null, sum(x.next30, (r) => r.amount), null],
        emptyText: 'لا توجد مستحقات خلال 30 يومًا',
      },
      [7],
      [1],
    );

    sheet(
      'الشيكات',
      {
        title: `الشيكات${limitNote(x.chequesTruncated)}`,
        headers: ['رقم الشيك', 'البنك', 'الاستحقاق', 'العميل', 'الوحدة', 'العقد / الحجز', 'المبلغ', 'الحالة'],
        rows: x.cheques.map((q) => [q.number, q.bank, q.dueDate ?? '—', q.customer, q.unit, q.reference, q.amount, q.statusLabel]),
        widths: [16, 20, 14, 26, 16, 16, 18, 14],
        numeric: [1, 3, 7],
        totals: ['الإجمالي', null, null, null, null, null, sum(x.cheques, (q) => q.amount), null],
        emptyText: 'لا توجد شيكات',
      },
      [7],
      [3],
    );

    const o = financialOutflows(data);
    const N = (v: string) => Number(v) || 0;
    const out: Array<[string, number | string, number, number]> = [
      ['عمولات الوسطاء', N(o.brokerCommissions.pendingAmount), N(o.brokerCommissions.unpaidAmount), N(o.brokerCommissions.paidAmount)],
      ['مكافآت فريق المبيعات', N(o.salesBonus.pendingAmount), N(o.salesBonus.approvedAmount), N(o.salesBonus.paidAmount)],
      ['مستردات العملاء (عقود ملغاة)', '—', N(o.refundsOwed), N(o.refundsPaid)],
    ];
    const outWs = sheet(
      'المدفوعات والالتزامات',
      {
        title: 'المدفوعات والالتزامات',
        headers: ['البند', 'قيد الاعتماد', 'مستحق الدفع', 'تم دفعه'],
        rows: out,
        widths: [32, 18, 18, 18],
        numeric: [2, 3, 4],
        totals: [
          'الإجمالي',
          sum(out, (r) => (typeof r[1] === 'number' ? r[1] : 0)),
          sum(out, (r) => r[2]),
          sum(out, (r) => r[3]),
        ],
      },
      [2, 3, 4],
    );
    if (N(o.clawbacksOwed) > 0) {
      outWs.addRow([]);
      const note = outWs.addRow(['مستحق للشركة استرداده من عمولات ومكافآت عقود ملغاة', N(o.clawbacksOwed)]);
      note.getCell(1).font = { italic: true };
      note.getCell(2).numFmt = amountFormat(currency);
    }

    sheet(
      'دفتر التحصيلات',
      {
        title: `دفتر التحصيلات${limitNote(x.ledgerTruncated)}`,
        headers: ['التاريخ', 'العميل', 'الوحدة', 'العقد / الحجز', 'البند', 'طريقة الدفع', 'المبلغ', 'الحالة'],
        rows: x.ledger.map((r) => [
          excelLocalDate(r.paidAt, brand.timezone),
          r.customer,
          r.unit,
          r.reference,
          r.type,
          r.method,
          r.amount,
          r.stateLabel,
        ]),
        widths: [14, 26, 16, 16, 14, 14, 18, 20],
        numeric: [1, 7],
        totals: ['إجمالي المحصّل', null, null, null, null, null, x.ledgerCollected, null],
        emptyText: 'لا توجد دفعات في الفترة',
      },
      [7],
      [1],
    );
  }

  /** The company identity (name, logo, colours) on report files. */
  private async brand(): Promise<ReportBrand> {
    const companyId = getRequiredCompanyId();
    return this.reportBrand?.forCompany(companyId) ?? fallbackBrand(await getCompanyCurrency(this.prisma, companyId));
  }

  // ── PDF exports ──────────────────────────────────────────────────────────
  // Presentation reports: HTML templates (report-templates.ts) printed by
  // Chromium (ReportPdfService). Each fetches the same data as the matching
  // JSON/CSV endpoint — no business logic is duplicated. Where Chromium is not
  // installed, sales/financial/broker fall back to the plain PDFKit layout.

  /** HTML → PDF, or the PDFKit fallback when Chromium is missing or fails. */
  private presentPdf(html: string, brand: ReportBrand, fallback?: () => Promise<Buffer>): Promise<Buffer> {
    return presentReportPdf(this.reportPdf, html, brand, fallback);
  }

  async adminSummaryPdf(): Promise<Buffer> {
    const [s, brand] = await Promise.all([this.adminSummary(), this.brand()]);
    const alerts = (
      [
        ['عقود بانتظار التوقيع', s.alerts.contractsAwaitingSignature],
        ['دفعات بانتظار المراجعة', s.alerts.depositsPendingReview],
        ['طلبات صيانة مفتوحة', s.alerts.openMaintenance],
        ['حجوزات تنتهي قريباً', s.alerts.reservationsExpiringSoon],
        ['زيارات بانتظار تأكيد العميل', s.alerts.visitsAwaitingConfirmation],
        ['استفسارات مفتوحة', s.alerts.infoRequestsOpen],
      ] as Array<[string, number]>
    ).filter(([, n]) => n > 0);
    return this.presentPdf(dashboardReportHtml({ ...s, alerts }, brand), brand);
  }

  async operationalPdf(): Promise<Buffer> {
    const [k, reservationsByStatus, brand] = await Promise.all([this.kpis(), this.reservations(), this.brand()]);
    const html = operationalReportHtml(
      {
        projects: k.projects,
        units: k.units,
        leads: k.leads,
        pendingVisits: k.pendingVisits,
        contracts: k.contracts,
        depositsTotal: Number(k.depositsTotal),
        reservationsByStatus,
      },
      brand,
    );
    return this.presentPdf(html, brand);
  }

  async financialDashboardPdf(opts: {
    projectId?: string;
    q?: string;
    type?: DepositType;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<Buffer> {
    const [data, brand] = await Promise.all([this.financialDashboard({ ...opts, detail: true }), this.brand()]);
    const project = opts.projectId
      ? await this.prisma.project.findFirst({
          where: { id: opts.projectId, companyId: getRequiredCompanyId() },
          select: { name: true },
        })
      : null;
    const filters = financialFilterPairs(opts, project && translatableAr(project.name)).map(([k, v]) => `${k}: ${v}`);
    const html = financialDashboardReportHtml(
      {
        summary: data.summary,
        unpaidLiabilities: data.liabilities.totalUnpaidLiabilities,
        collectionByType: data.collectionByType,
        aging: data.aging,
        filters,
        detail: data.detail,
        trend: data.cashflowTrend,
        outflows: financialOutflows(data),
      },
      brand,
    );
    return this.presentPdf(html, brand);
  }

  async salesPdf(period?: string, dateFrom?: string, dateTo?: string): Promise<Buffer> {
    const data = await this.sales(period, dateFrom, dateTo);

    // Resolve Arabic project names for the breakdown.
    const ids = (data.byProject ?? []).map((p) => p.projectId);
    const projects = ids.length
      ? await this.prisma.project.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(projects.map((p) => [p.id, translatableAr(p.name)]));
    const byProject = (data.byProject ?? []).map((p) => ({
      name: nameById.get(p.projectId) ?? p.projectId,
      count: p.count,
      total: Number(p.total),
    }));
    const brand = await this.brand();
    const html = salesReportHtml(
      { contracts: data.contracts, total: Number(data.total), byProject, periodLabel: reportPeriodLabel(period, dateFrom, dateTo) },
      brand,
    );
    return this.presentPdf(html, brand, () =>
      buildSalesPdf({ contracts: data.contracts, total: Number(data.total), byProject, period, dateFrom, dateTo }, brand),
    );
  }

  /** A "YYYY-MM" period: that month in the company's time zone. */
  private async periodMonth(period: string) {
    const [y, m] = period.split('-').map(Number);
    return localMonth(y!, m ?? 1, await currentCompanyTimeZone(this.prisma, getTenantContext()?.companyId));
  }

  private async periodWhereContract(period: string): Promise<Prisma.ContractWhereInput> {
    const { start, end } = await this.periodMonth(period);
    return { signedAt: { gte: start, lt: end } };
  }

  private async periodWhereDeposit(period: string): Promise<Prisma.DepositWhereInput> {
    const { start, end } = await this.periodMonth(period);
    return { paidAt: { gte: start, lt: end } };
  }
}
