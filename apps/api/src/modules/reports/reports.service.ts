import { Injectable, Optional } from '@nestjs/common';
import {
  AppointmentStatus,
  BonusEntryStatus,
  BrokerCommissionStatus,
  BrokerPayoutStatus,
  DepositType,
  DocumentCategory,
  DocumentOwnerType,
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
  brokerReportHtml,
  dashboardReportHtml,
  DEPOSIT_TYPE_AR,
  financialDashboardReportHtml,
  financialReportHtml,
  operationalReportHtml,
  salesReportHtml,
} from './report-templates';
import { csvSections, toCsv, type CsvCell } from '../../common/utils/csv';
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
  amountFormat,
  createReportWorkbook,
  excelLocalDate,
  formatMoneyColumns,
  formatStamp,
  setupBoardSheet,
  styleTotalsRow,
  workbookToBuffer,
} from '../../common/utils/xlsx';
import {
  renderBarChartPng,
  renderShareChartPng,
} from '../../common/utils/xlsx-chart';
import {
  againstDueDepositWhere,
  COLLECTED_DEPOSIT_WHERE,
  FEES_DEPOSIT_WHERE,
  RECORDED_DEPOSIT_WHERE,
  TOWARDS_PRICE_DEPOSIT_WHERE,
} from '../../common/finance/collected';
import { commissionBasis, MARKUP_SNAPSHOT_SELECT, NET_PRICE_SQL, netContractValue } from '../../common/finance/commission-basis';
import {
  BILLABLE_PLAN_WHERE,
  LIVE_CONTRACT_WHERE,
  LIVE_PLAN_WHERE,
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
      this.prisma.installment.aggregate({
        where: { status: InstallmentStatus.OVERDUE, plan: LIVE_PLAN_WHERE },
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
        where: { status: InstallmentStatus.PENDING, dueDate: { gte: today, lte: in30 }, plan: LIVE_PLAN_WHERE },
        _sum: { amount: true },
      }),
      this.prisma.installment.aggregate({
        where: { status: InstallmentStatus.PENDING, dueDate: { gt: in30, lte: in60 }, plan: LIVE_PLAN_WHERE },
        _sum: { amount: true },
      }),
      this.prisma.installment.aggregate({
        where: { status: InstallmentStatus.PENDING, dueDate: { gt: in60, lte: in90 }, plan: LIVE_PLAN_WHERE },
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
    const [collectedTowardsPriceAgg, overdueTowardsPriceAgg, feesCollectedAgg, dueRowsAgg, dueBookingAgg, collectedAgainstDueAgg, totalContractValue] = await Promise.all([
      this.prisma.deposit.aggregate({
        where: { AND: [COLLECTED_DEPOSIT_WHERE, TOWARDS_PRICE_DEPOSIT_WHERE] },
        _sum: { amount: true },
      }),
      this.prisma.installment.aggregate({
        where: { status: InstallmentStatus.OVERDUE, type: { notIn: SURCHARGE_PAYMENT_TYPES }, plan: LIVE_PLAN_WHERE },
        _sum: { amount: true },
      }),
      this.prisma.deposit.aggregate({
        where: { AND: [COLLECTED_DEPOSIT_WHERE, FEES_DEPOSIT_WHERE] },
        _sum: { amount: true },
      }),
      this.prisma.installment.aggregate({
        where: {
          status: { not: InstallmentStatus.CANCELLED },
          type: { notIn: SURCHARGE_PAYMENT_TYPES },
          dueDate: { lte: today },
          plan: LIVE_PLAN_WHERE,
        },
        _sum: { amount: true },
      }),
      this.prisma.reservation.aggregate({
        where: { contract: { is: LIVE_CONTRACT_WHERE } },
        _sum: { bookingAmount: true },
      }),
      // The collection rate's numerator: collected against what is due by
      // today (decided 2026-10-17) — early payments don't count.
      this.prisma.deposit.aggregate({
        where: { AND: [COLLECTED_DEPOSIT_WHERE, TOWARDS_PRICE_DEPOSIT_WHERE, againstDueDepositWhere(today)] },
        _sum: { amount: true },
      }),
      // Contract value: signed contracts at their net price (decided 2026-10-17).
      netContractValue(this.prisma, { signedAt: { not: null }, ...LIVE_CONTRACT_WHERE }),
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
        dueToDate:
          Number(dueRowsAgg._sum.amount ?? 0) + Number(dueBookingAgg._sum.bookingAmount ?? 0),
        collectedAgainstDue:      Number(collectedAgainstDueAgg._sum.amount         ?? 0),
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
                      where: { signedAt: { not: null }, ...LIVE_CONTRACT_WHERE },
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
   * P14.1 — admin dashboard summary as a downloadable CSV. Built from the SAME
   * real `adminSummary()` data (KPIs, reservation trend, lead sources, alerts,
   * recent activity) as stacked tables. No demo values.
   */
  async adminSummaryCsv(): Promise<string> {
    const [s, brand] = await Promise.all([this.adminSummary(), this.brand()]);

    const kpiRows: CsvCell[][] = [
      ['المشاريع المنشورة', s.kpis.projects],
      ['إجمالي الوحدات', s.kpis.totalUnits],
      ['وحدات متاحة', s.kpis.availableUnits],
      ['وحدات محجوزة', s.kpis.reservedUnits],
      ['فرص جديدة هذا الشهر', s.kpis.newLeadsThisMonth],
      ['دفعات بانتظار المراجعة', s.kpis.pendingDeposits],
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
      formatStamp(a.createdAt, brand.timezone),
    ]);

    return csvSections([
      'المؤشرات الرئيسية',
      toCsv(['المؤشر', 'القيمة'], kpiRows),
      '',
      'اتجاه الحجوزات (آخر 6 أشهر)',
      toCsv(['الشهر', 'اسم الشهر', 'عدد الحجوزات'], trendRows),
      '',
      'توزيع مصادر العملاء المحتملين',
      toCsv(['المصدر', 'العدد'], leadRows),
      '',
      'التنبيهات المعلقة',
      toCsv(['التنبيه', 'العدد'], alertRows),
      '',
      'آخر النشاطات',
      toCsv(['النشاط', 'الجهة', 'السياق', 'التاريخ'], activityRows),
    ]);
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
    const instAnd: Prisma.InstallmentWhereInput[] = [{ plan: LIVE_PLAN_WHERE }];
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
        where: filteredDepWhere(),
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.deposit.groupBy({
        by: ['type'],
        where: filteredDepWhere(COLLECTED_DEPOSIT_WHERE),
        _sum: { amount: true },
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
    const signedContractWhere: Prisma.ContractWhereInput = { AND: [contractWhere, { signedAt: { not: null } }] };
    const [totalContractValue, dueRowsAgg, dueBookingAgg, againstDueAgg] = await Promise.all([
      netContractValue(this.prisma, signedContractWhere),
      this.prisma.installment.aggregate({
        where: instWhere({ status: { not: InstallmentStatus.CANCELLED }, type: { notIn: SURCHARGE_PAYMENT_TYPES }, dueDate: { lte: todayUTC } }),
        _sum: { amount: true },
      }),
      this.prisma.reservation.aggregate({ where: { contract: { is: contractWhere } }, _sum: { bookingAmount: true } }),
      this.prisma.deposit.aggregate({
        where: baseDepWhere({ AND: [COLLECTED_DEPOSIT_WHERE, TOWARDS_PRICE_DEPOSIT_WHERE, againstDueDepositWhere(todayUTC)] }),
        _sum: { amount: true },
      }),
    ]);
    const dueToDate = D(dueRowsAgg._sum.amount).plus(D(dueBookingAgg._sum.bookingAmount));
    const collectedAgainstDue = D(againstDueAgg._sum.amount);
    const collectedAll = D(recordedAgg._sum.amount);
    const collectedVerified = D(totalCollectedAgg._sum.amount);
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
      acc.count += g._count?._all ?? 0;
      acc.all = acc.all.plus(D(g._sum.amount));
    }
    for (const g of byTypeCollectedGroups) {
      const acc = byType.get(g.type);
      if (acc) acc.verified = acc.verified.plus(D(g._sum.amount));
    }
    for (const acc of byType.values()) acc.unverified = acc.all.minus(acc.verified);
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
      ['الفترة', reportPeriodLabel(period, dateFrom, dateTo)],
      ['عدد العقود', data.contracts],
      ['إجمالي المبيعات (السعر الصافي)', Number(data.total).toFixed(2)],
    ];

    // Section 2 — per-project breakdown, by name
    const ids = (data.byProject ?? []).map((p) => p.projectId);
    const projects = ids.length
      ? await this.prisma.project.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
      : [];
    const nameById = new Map(projects.map((p) => [p.id, translatableAr(p.name)]));
    const projectHeaders = ['المشروع', 'عدد العقود', 'إجمالي المبيعات'];
    const projectRows: CsvCell[][] = (data.byProject ?? []).map((p) => [
      nameById.get(p.projectId) ?? p.projectId,
      p.count,
      Number(p.total).toFixed(2),
    ]);

    return csvSections([
      toCsv(['المؤشر', 'القيمة'], summaryRows),
      '',
      toCsv(projectHeaders, projectRows),
    ]);
  }

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

  async financialCsv(period?: string, dateFrom?: string, dateTo?: string): Promise<string> {
    const data = await this.financial(period, dateFrom, dateTo);
    const rows: CsvCell[][] = [
      ['الفترة', reportPeriodLabel(period, dateFrom, dateTo)],
      ['عدد الدفعات', data.deposits],
      ['الدفعات الموثّقة', data.verified],
      ['المحصّل من السعر', Number(data.total).toFixed(2)],
      ['الرسوم والغرامات', Number(data.fees).toFixed(2)],
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

    const statusChart = await renderShareChartPng({
      width: 560,
      height: 320,
      series: [
        { label: 'موثّقة', value: data.verified },
        { label: 'غير موثّقة', value: unverified },
      ],
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
        { label: 'الفترة', value: reportPeriodLabel(period, dateFrom, dateTo) },
        { label: 'عدد الدفعات', value: data.deposits },
        { label: 'الدفعات الموثّقة', value: data.verified },
        { label: 'الدفعات غير الموثّقة', value: unverified },
        { label: 'المحصّل من السعر', value: Number(data.total), currency },
        { label: 'الرسوم والغرامات', value: Number(data.fees), currency },
      ],
      { span: SPAN, perRow: 3 },
    );
    addChartBlock(wb, cover, 'توزيع الدفعات حسب التوثيق', statusChart, { span: SPAN, width: 560, height: 320 });
    addFooter(cover, brand);

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

    return csvSections([
      toCsv(['المؤشر', 'القيمة'], kpiRows),
      '',
      toCsv(['حالة الحجز', 'العدد'], reservationRows),
    ]);
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
      ['totalContractValue', 'قيمة العقود الموقّعة (السعر الصافي)', s.totalContractValue],
      // Collected as two figures, as on the screen (decided 2026-10-16).
      ['collectedTowardsPrice', 'المحصّل من السعر', s.collectedTowardsPrice],
      ['feesCollected', 'الرسوم والغرامات', s.feesCollected],
      ['dueToDate', 'المستحق حتى اليوم', s.dueToDate],
      ['collectedAgainstDue', 'المحصّل من المستحق', s.collectedAgainstDue],
      ['totalCollectedVerified', 'المحصّل المؤكد (الكل)', s.totalCollectedVerified],
      ['totalCollectedAll', 'إجمالي المحصّل المسجل', s.totalCollectedAll],
      ['totalCollectedUnverified', 'المحصّل غير المؤكد', s.totalCollectedUnverified],
      ['totalOutstanding', 'المتبقي للتحصيل', s.totalOutstanding],
      ['dueSoonAmount', 'مستحق خلال 7 أيام', s.dueSoonAmount],
      ['overdueAmountComputed', 'المتأخر المحسوب', s.overdueAmountComputed],
      ['overdueInstallmentCountComputed', 'عدد الأقساط المتأخرة (محسوبة)', s.overdueInstallmentCountComputed],
      ['totalRemaining', 'المتبقي (قديم)', s.totalRemaining],
      ['totalOverdue', 'المتأخر (قديم)', s.totalOverdue],
      ['collectedThisMonth', 'المحصّل هذا الشهر', s.collectedThisMonth],
      ['refundsPaid', 'المستردات المصروفة', s.refundsPaid],
      ['refundsOwed', 'المستردات المستحقة للعملاء', s.refundsOwed],
      ['netCollected', 'صافي المحصّل بعد المستردات', s.netCollected],
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
      FEE: 'رسوم وغرامات',
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

    return csvSections([
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
    ]);
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
    addBoardBanner(cover, 'لوحة المؤشرات المالية', SPAN, { wb, brand });

    addSectionTitle(cover, 'الملخص التنفيذي', SPAN);
    addKpiCards(
      cover,
      [
        { label: 'قيمة العقود الموقّعة', value: Number(s.totalContractValue), currency },
        { label: 'المحصّل من السعر', value: Number(s.collectedTowardsPrice), currency },
        { label: 'الرسوم والغرامات', value: Number(s.feesCollected), currency },
        { label: 'المحصّل غير المؤكد', value: Number(s.totalCollectedUnverified), currency },
        { label: 'المتبقي للتحصيل', value: Number(s.totalOutstanding), currency },
        { label: 'المحصّل هذا الشهر', value: Number(s.collectedThisMonth), currency },
        { label: 'المستحق هذا الشهر', value: Number(s.dueThisMonth), currency },
        { label: 'صافي المحصّل بعد المستردات', value: Number(s.netCollected), currency },
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
      ['النوع', 'العدد', 'الإجمالي', 'المؤكد', 'غير المؤكد'],
      data.collectionByType.map((c) => [
        DEP_TYPE_LABEL[c.type] ?? c.type, c.count,
        Number(c.totalAll), Number(c.totalVerified), Number(c.totalUnverified),
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

    return workbookToBuffer(wb);
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
    const [data, brand] = await Promise.all([this.financialDashboard(opts), this.brand()]);
    const project = opts.projectId
      ? await this.prisma.project.findFirst({
          where: { id: opts.projectId, companyId: getRequiredCompanyId() },
          select: { name: true },
        })
      : null;
    const filters = [
      project && `المشروع: ${translatableAr(project.name)}`,
      opts.type && `النوع: ${DEPOSIT_TYPE_AR[opts.type] ?? opts.type}`,
      opts.q && `بحث: ${opts.q}`,
      reportPeriodLabel(undefined, opts.dateFrom, opts.dateTo) !== 'كل الفترات' &&
        `الفترة: ${reportPeriodLabel(undefined, opts.dateFrom, opts.dateTo)}`,
    ].filter((f): f is string => Boolean(f));
    const html = financialDashboardReportHtml(
      {
        summary: data.summary,
        unpaidLiabilities: data.liabilities.totalUnpaidLiabilities,
        collectionByType: data.collectionByType,
        aging: data.aging,
        filters,
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

  async financialPdf(period?: string, dateFrom?: string, dateTo?: string): Promise<Buffer> {
    const data = await this.financial(period, dateFrom, dateTo);
    const brand = await this.brand();
    const html = financialReportHtml(
      { deposits: data.deposits, verified: data.verified, total: Number(data.total), fees: Number(data.fees), periodLabel: reportPeriodLabel(period, dateFrom, dateTo) },
      brand,
    );
    return this.presentPdf(html, brand, () =>
      buildFinancialPdf(
        { deposits: data.deposits, verified: data.verified, total: Number(data.total), period, dateFrom, dateTo },
        brand,
      ),
    );
  }

  async brokerPdf(dateFrom?: string, dateTo?: string): Promise<Buffer> {
    const brokers = (await this.brokerLeaderboard(dateFrom, dateTo)).map((b) => ({
      brokerName: b.brokerName,
      count: b.count,
      commissionAmount: b.commissionAmount,
    }));
    const brand = await this.brand();
    const html = brokerReportHtml({ brokers, periodLabel: reportPeriodLabel(undefined, dateFrom, dateTo) }, brand);
    return this.presentPdf(html, brand, () => buildBrokerPdf({ brokers, dateFrom, dateTo }, brand));
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
