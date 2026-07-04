import { Injectable, NotFoundException } from '@nestjs/common';
import {
  BrokerCommissionStatus,
  BrokerPayoutStatus,
  BrokerStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  AgentsReportQueryDto,
  BrokerDetailReportQueryDto,
  BrokerReportsSummaryQueryDto,
  ProjectsReportQueryDto,
  TopBrokersQueryDto,
  TopMetric,
} from './dto/broker-report.dto';
import { toCsv } from '../../common/utils/csv';
import {
  addBoardBanner,
  addChartBlock,
  addFooter,
  addKpiCards,
  addSectionTitle,
  addTable,
  addTitledTable,
  createReportWorkbook,
  setupBoardSheet,
  workbookToBuffer,
} from '../../common/utils/xlsx';
import { renderBarChartPng } from '../../common/utils/xlsx-chart';
import { brandLogoPng } from '../../common/utils/brand';

const TOP_METRIC_LABEL: Record<TopMetric, string> = {
  leads: 'الفرص',
  reservations: 'الحجوزات',
  contracts: 'العقود',
  salesGross: 'إجمالي المبيعات',
  commissionNet: 'صافي العمولات',
  payoutNet: 'صافي المدفوعات',
};

/**
 * Date basis used throughout this service (per Phase 10 spec):
 *   Leads, Visits, Reservations, Contracts.createdAt   → createdAt
 *   Contracts (signed)                                  → signedAt
 *   BrokerCommission                                    → earnedAt
 *   BrokerPayout (created/approved/total counts)        → createdAt
 *   BrokerPayout (paid totals + counts)                 → paidAt
 *
 * salesGross is computed as the sum of Contract.totalAmount for SIGNED broker
 * contracts only. Unsigned contracts don't represent realised sales, and
 * including them would inflate sales numbers for contracts that may never
 * close (admin can revoke or cancel before signing).
 */
@Injectable()
export class BrokerReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Public endpoints ────────────────────────────────────────────────────

  async summary(query: BrokerReportsSummaryQueryDto) {
    const range = this.parseRange(query.from, query.to);

    const brokerFilter: Prisma.BrokerWhereInput = {};
    const counts = this.aggregateCommonCounts({
      brokerId: query.brokerId,
      brokerAgentId: query.brokerAgentId,
      projectId: query.projectId,
      range,
    });

    const [
      brokers,
      activeBrokers,
      brokerAgents,
      leadStats,
      visitsRequested,
      reservationStats,
      contractStats,
      salesGross,
      commissionStats,
      commissionTotals,
      payoutStats,
      payoutPaidTotal,
    ] = await Promise.all([
      this.prisma.broker.count({ where: brokerFilter }),
      this.prisma.broker.count({ where: { status: BrokerStatus.ACTIVE } }),
      this.prisma.brokerUser.count(),
      counts.leadStats(),
      counts.visitsRequested(),
      counts.reservationStats(),
      counts.contractStats(),
      counts.salesGross(),
      counts.commissionStats(),
      counts.commissionTotals(),
      counts.payoutStats(),
      counts.payoutPaidTotal(),
    ]);

    const summary = {
      totalBrokers: brokers,
      activeBrokers,
      totalBrokerAgents: brokerAgents,
      ...leadStats,
      visitsRequested,
      ...reservationStats,
      ...contractStats,
      salesGross: salesGross.toString(),
      ...commissionStats,
      commissionsGross: commissionTotals.gross.toString(),
      commissionsNet: commissionTotals.net.toString(),
      commissionsPendingNet: commissionTotals.pendingNet.toString(),
      ...payoutStats,
      payoutsTotalNet: payoutPaidTotal.toString(),
    };

    const rates = this.computeRates(summary);

    return { ...summary, ...rates };
  }

  async topBrokers(query: TopBrokersQueryDto) {
    const range = this.parseRange(query.from, query.to);
    const metric: TopMetric = query.metric ?? 'salesGross';
    const limit = query.limit ?? 10;

    // 1) Find all brokers that have at least one commission OR contract in
    //    the window. We use commission.brokerId / contract.brokerId as the
    //    universe of "active" brokers for this report.
    const [commissionBrokers, contractBrokers] = await Promise.all([
      this.prisma.brokerCommission.findMany({
        where: this.commissionWhere({ projectId: query.projectId, range }),
        distinct: ['brokerId'],
        select: { brokerId: true },
      }),
      this.prisma.contract.findMany({
        where: this.contractCreatedWhere({ projectId: query.projectId, range }),
        distinct: ['brokerId'],
        select: { brokerId: true },
      }),
    ]);
    const brokerIds = Array.from(
      new Set(
        [...commissionBrokers, ...contractBrokers]
          .map((r) => r.brokerId)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    if (brokerIds.length === 0) return { metric, limit, data: [] };

    // 2) Per-broker aggregates run in parallel.
    const rows = await Promise.all(
      brokerIds.map(async (brokerId) => {
        const c = this.aggregateCommonCounts({
          brokerId,
          projectId: query.projectId,
          range,
        });
        const [broker, leadStats, reservationStats, contractStats, salesGross, commissionTotals, payoutPaidTotal] =
          await Promise.all([
            this.prisma.broker.findUnique({
              where: { id: brokerId },
              select: { id: true, companyName: true, code: true, status: true },
            }),
            c.leadStats(),
            c.reservationStats(),
            c.contractStats(),
            c.salesGross(),
            c.commissionTotals(),
            c.payoutPaidTotal(),
          ]);
        if (!broker) return null;

        const approvedLeads = leadStats.leadsApproved;
        const reservations = reservationStats.reservationsCreated;
        const contracts = contractStats.contractsCreated;
        const leadToReservationRate = rate(reservations, approvedLeads);

        return {
          brokerId: broker.id,
          companyName: broker.companyName,
          code: broker.code,
          status: broker.status,
          leads: leadStats.leadsSubmitted,
          approvedLeads,
          reservations,
          contracts,
          contractsSigned: contractStats.contractsSigned,
          salesGross: salesGross.toString(),
          commissionGross: commissionTotals.gross.toString(),
          commissionNet: commissionTotals.net.toString(),
          payoutNet: payoutPaidTotal.toString(),
          conversionRate: leadToReservationRate,
        };
      }),
    );

    const filtered = rows.filter((r): r is NonNullable<typeof r> => Boolean(r));

    // 3) Sort by selected metric (Decimal-as-string-safe).
    filtered.sort((a, b) => {
      switch (metric) {
        case 'leads':
          return b.leads - a.leads;
        case 'reservations':
          return b.reservations - a.reservations;
        case 'contracts':
          return b.contracts - a.contracts;
        case 'salesGross':
          return Number(b.salesGross) - Number(a.salesGross);
        case 'commissionNet':
          return Number(b.commissionNet) - Number(a.commissionNet);
        case 'payoutNet':
          return Number(b.payoutNet) - Number(a.payoutNet);
      }
    });

    return { metric, limit, data: filtered.slice(0, limit) };
  }

  async brokerDetail(brokerId: string, query: BrokerDetailReportQueryDto) {
    const broker = await this.prisma.broker.findUnique({
      where: { id: brokerId },
      select: {
        id: true,
        companyName: true,
        commercialName: true,
        code: true,
        status: true,
        defaultCommissionPct: true,
        commissionModel: true,
        contractStartAt: true,
        contractEndAt: true,
        _count: { select: { brokerUsers: true, projectAccess: true, unitAccess: true } },
      },
    });
    if (!broker) throw new NotFoundException('Broker not found');

    const range = this.parseRange(query.from, query.to);
    const [summary, monthlyTrend, projectBreakdown, agentBreakdown, recent] =
      await Promise.all([
        this.summary({
          brokerId,
          brokerAgentId: query.brokerAgentId,
          projectId: query.projectId,
          from: query.from,
          to: query.to,
        }),
        this.monthlyTrend({
          brokerId,
          projectId: query.projectId,
          from: query.from,
          to: query.to,
        }),
        this.projectBreakdownForBroker({
          brokerId,
          range,
        }),
        this.agents({
          brokerId,
          projectId: query.projectId,
          from: query.from,
          to: query.to,
        }),
        this.recent({
          brokerId,
          range,
        }),
      ]);

    return {
      broker,
      summary,
      monthlyTrend,
      projectBreakdown,
      agentBreakdown: agentBreakdown.data,
      recent,
    };
  }

  async agents(query: AgentsReportQueryDto) {
    const range = this.parseRange(query.from, query.to);

    // Find broker agent userIds within the broker (if filtered).
    const agentRows = await this.prisma.brokerUser.findMany({
      where: { ...(query.brokerId ? { brokerId: query.brokerId } : {}) },
      select: {
        userId: true,
        brokerId: true,
        user: { select: { id: true, fullName: true, email: true, phone: true } },
      },
    });

    if (agentRows.length === 0) return { data: [] };

    const rows = await Promise.all(
      agentRows.map(async (a) => {
        const c = this.aggregateCommonCounts({
          brokerId: query.brokerId,
          brokerAgentId: a.userId,
          projectId: query.projectId,
          range,
        });
        const [leadStats, reservationStats, contractStats, salesGross, commissionTotals, payoutPaidTotal] =
          await Promise.all([
            c.leadStats(),
            c.reservationStats(),
            c.contractStats(),
            c.salesGross(),
            c.commissionTotals(),
            c.payoutPaidTotal(),
          ]);
        return {
          brokerAgentId: a.userId,
          brokerId: a.brokerId,
          fullName: a.user.fullName,
          email: a.user.email,
          phone: a.user.phone,
          leadsSubmitted: leadStats.leadsSubmitted,
          approvedLeads: leadStats.leadsApproved,
          reservations: reservationStats.reservationsCreated,
          contracts: contractStats.contractsCreated,
          contractsSigned: contractStats.contractsSigned,
          salesGross: salesGross.toString(),
          commissionGross: commissionTotals.gross.toString(),
          commissionNet: commissionTotals.net.toString(),
          payoutNet: payoutPaidTotal.toString(),
        };
      }),
    );

    // Sort by salesGross desc by default — most-active agents first.
    rows.sort((a, b) => Number(b.salesGross) - Number(a.salesGross));
    return { data: rows };
  }

  async projects(query: ProjectsReportQueryDto) {
    const range = this.parseRange(query.from, query.to);

    // Project breakdown built from BrokerCommission rows because they carry
    // projectId directly. Contracts join via unit→building→phase→project,
    // which is awkward for groupBy — we approximate contract counts by
    // counting distinct contractIds within the commission window per project.
    const commissions = await this.prisma.brokerCommission.findMany({
      where: {
        ...this.commissionWhere({ brokerId: query.brokerId, range }),
        status: { notIn: [BrokerCommissionStatus.CANCELLED, BrokerCommissionStatus.REJECTED] },
      },
      select: {
        projectId: true,
        brokerId: true,
        contractId: true,
        grossAmount: true,
        netAmount: true,
        basisAmount: true,
        contract: { select: { signedAt: true } },
        payout: { select: { status: true } },
      },
    });

    type ProjectAgg = {
      projectId: string;
      brokerIds: Set<string>;
      contractIds: Set<string>;
      signedContractIds: Set<string>;
      salesGross: Prisma.Decimal;
      commissionGross: Prisma.Decimal;
      commissionNet: Prisma.Decimal;
      payoutNet: Prisma.Decimal;
    };

    const byProject = new Map<string, ProjectAgg>();
    for (const c of commissions) {
      const agg =
        byProject.get(c.projectId) ??
        ({
          projectId: c.projectId,
          brokerIds: new Set(),
          contractIds: new Set(),
          signedContractIds: new Set(),
          salesGross: new Prisma.Decimal(0),
          commissionGross: new Prisma.Decimal(0),
          commissionNet: new Prisma.Decimal(0),
          payoutNet: new Prisma.Decimal(0),
        } satisfies ProjectAgg);
      agg.brokerIds.add(c.brokerId);
      agg.contractIds.add(c.contractId);
      if (c.contract?.signedAt) {
        agg.signedContractIds.add(c.contractId);
        agg.salesGross = agg.salesGross.add(c.basisAmount);
      }
      agg.commissionGross = agg.commissionGross.add(c.grossAmount);
      agg.commissionNet = agg.commissionNet.add(c.netAmount);
      // Attribute the paid amount per-commission (not per-payout) to avoid
      // double-counting a single payout across multiple projects.
      if (c.payout?.status === BrokerPayoutStatus.PAID) {
        agg.payoutNet = agg.payoutNet.add(c.netAmount);
      }
      byProject.set(c.projectId, agg);
    }

    // Resolve project names in one go.
    const projectIds = Array.from(byProject.keys());
    const projects =
      projectIds.length > 0
        ? await this.prisma.project.findMany({
            where: { id: { in: projectIds } },
            select: { id: true, name: true, city: true },
          })
        : [];
    const projectMap = new Map(projects.map((p) => [p.id, p]));

    const rows = Array.from(byProject.values()).map((agg) => {
      const project = projectMap.get(agg.projectId);
      return {
        projectId: agg.projectId,
        projectName: project?.name ?? null,
        city: project?.city ?? null,
        brokerCount: agg.brokerIds.size,
        contracts: agg.contractIds.size,
        contractsSigned: agg.signedContractIds.size,
        salesGross: agg.salesGross.toString(),
        commissionGross: agg.commissionGross.toString(),
        commissionNet: agg.commissionNet.toString(),
        payoutNet: agg.payoutNet.toString(),
      };
    });

    rows.sort((a, b) => Number(b.salesGross) - Number(a.salesGross));
    return { data: rows };
  }

  /**
   * Compact monthly trend over the last 6 months ending at `to` (or today).
   * Returns one bucket per month with reservations/contracts/commissions/payouts.
   */
  async monthlyTrend(query: {
    brokerId?: string;
    projectId?: string;
    from?: string;
    to?: string;
  }) {
    // Default window: last 6 months. We honour query.from / query.to when
    // they're inside a 6-month span; otherwise we anchor on the end.
    const end = query.to ? new Date(query.to) : new Date();
    const startBase = query.from ? new Date(query.from) : new Date(end);
    if (!query.from) startBase.setMonth(end.getMonth() - 5);
    // Normalise to the first day of the month.
    startBase.setUTCDate(1);
    startBase.setUTCHours(0, 0, 0, 0);

    const months: { label: string; start: Date; end: Date }[] = [];
    const cursor = new Date(startBase);
    while (cursor <= end && months.length < 24) {
      const start = new Date(cursor);
      const next = new Date(cursor);
      next.setUTCMonth(next.getUTCMonth() + 1);
      months.push({
        label: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`,
        start,
        end: next,
      });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    const buckets = await Promise.all(
      months.map(async ({ label, start, end }) => {
        const range = { gte: start, lt: end };
        const c = this.aggregateCommonCounts({
          brokerId: query.brokerId,
          projectId: query.projectId,
          range: { from: start, to: end, inclusive: false },
        });
        const [reservations, contracts, commissions, payouts] = await Promise.all([
          c.reservationStats().then((r) => r.reservationsCreated),
          c.contractStats().then((r) => r.contractsSigned),
          this.prisma.brokerCommission.aggregate({
            _sum: { netAmount: true },
            where: this.commissionWhere({
              brokerId: query.brokerId,
              projectId: query.projectId,
              range: { from: start, to: end, inclusive: false },
            }),
          }),
          this.prisma.brokerPayout.aggregate({
            _sum: { totalNet: true },
            where: {
              ...(query.brokerId ? { brokerId: query.brokerId } : {}),
              status: BrokerPayoutStatus.PAID,
              paidAt: range,
            },
          }),
        ]);
        return {
          label,
          reservations,
          contractsSigned: contracts,
          commissionsNet: (commissions._sum.netAmount ?? new Prisma.Decimal(0)).toString(),
          payoutsNet: (payouts._sum.totalNet ?? new Prisma.Decimal(0)).toString(),
        };
      }),
    );

    return buckets;
  }

  // ── CSV exports ─────────────────────────────────────────────────────────

  async summaryCsv(query: BrokerReportsSummaryQueryDto) {
    const s = await this.summary(query);
    const rows: [string, string | number][] = [
      ['الوسطاء الإجماليون', s.totalBrokers],
      ['الوسطاء النشطون', s.activeBrokers],
      ['وكلاء الوسطاء', s.totalBrokerAgents],
      ['الفرص المرسلة', s.leadsSubmitted],
      ['الفرص المعتمدة', s.leadsApproved],
      ['الفرص المرفوضة', s.leadsRejected],
      ['الفرص المكررة', s.leadsDuplicate],
      ['الزيارات المطلوبة', s.visitsRequested],
      ['الحجوزات المُنشأة', s.reservationsCreated],
      ['الحجوزات المعتمدة', s.reservationsApproved],
      ['الحجوزات الملغاة', s.reservationsCancelled],
      ['العقود المُنشأة', s.contractsCreated],
      ['العقود الموقّعة', s.contractsSigned],
      ['إجمالي المبيعات', s.salesGross],
      ['عمولات قيد الانتظار', s.commissionsPending],
      ['عمولات معتمدة', s.commissionsApproved],
      ['عمولات مرفوضة', s.commissionsRejected],
      ['عمولات ملغاة', s.commissionsCancelled],
      ['إجمالي العمولات', s.commissionsGross],
      ['صافي العمولات', s.commissionsNet],
      ['مدفوعات مسودة', s.payoutsDraft],
      ['مدفوعات معتمدة', s.payoutsApproved],
      ['مدفوعات قيد التنفيذ', s.payoutsProcessing],
      ['مدفوعات مدفوعة', s.payoutsPaid],
      ['صافي المدفوعات', s.payoutsTotalNet],
      ['نسبة الفرصة → الحجز', formatRate(s.leadToReservationRate)],
      ['نسبة الحجز → العقد', formatRate(s.reservationToContractRate)],
      ['نسبة العقد الموقّع', formatRate(s.signedContractRate)],
      ['نسبة العقد → الدفع', formatRate(s.contractToPaidPayoutRate)],
    ];
    return toCsv(['المؤشر', 'القيمة'], rows);
  }

  /**
   * P15.4 — broker performance as a board-style XLSX: branded cover with an
   * executive summary + a top-brokers (by sales) bar chart, plus a top-brokers
   * detail sheet. Same real `summary()` + `topBrokers()` data as the CSV. Chart
   * degrades gracefully to tables-only on failure.
   */
  async summaryBoardXlsx(query: BrokerReportsSummaryQueryDto) {
    const [s, top] = await Promise.all([
      this.summary(query),
      this.topBrokers({ from: query.from, to: query.to, projectId: query.projectId, metric: 'salesGross', limit: 8 }),
    ]);

    const topChart = await renderBarChartPng({
      title: 'أعلى الوسطاء حسب المبيعات',
      series: top.data.map((r) => ({ label: r.companyName, value: Number(r.salesGross) })),
    });

    const SPAN = 6;
    const wb = createReportWorkbook();
    const cover = wb.addWorksheet('الملخص');
    setupBoardSheet(cover, { widths: [16, 16, 16, 16, 16, 16], landscape: true });
    addBoardBanner(cover, 'تقرير أداء الوسطاء', SPAN, { wb, logo: brandLogoPng() });
    addSectionTitle(cover, 'الملخص التنفيذي', SPAN);
    addKpiCards(
      cover,
      [
        { label: 'الوسطاء الإجماليون', value: s.totalBrokers },
        { label: 'الوسطاء النشطون', value: s.activeBrokers },
        { label: 'وكلاء الوسطاء', value: s.totalBrokerAgents },
        { label: 'الفرص المرسلة', value: s.leadsSubmitted },
        { label: 'الفرص المعتمدة', value: s.leadsApproved },
        { label: 'الحجوزات المُنشأة', value: s.reservationsCreated },
        { label: 'العقود الموقّعة', value: s.contractsSigned },
        { label: 'إجمالي المبيعات', value: Number(s.salesGross) },
        { label: 'صافي العمولات', value: Number(s.commissionsNet) },
        { label: 'صافي المدفوعات', value: Number(s.payoutsTotalNet) },
      ],
      { span: SPAN, perRow: 3 },
    );
    addChartBlock(wb, cover, 'أعلى الوسطاء حسب المبيعات', topChart, { span: SPAN, width: 720, height: 320 });
    addFooter(cover);

    const topSheet = wb.addWorksheet('أعلى الوسطاء');
    addTable(
      topSheet,
      ['الوسيط', 'الكود', 'إجمالي المبيعات', 'صافي العمولات', 'صافي المدفوعات'],
      top.data.map((r) => [r.companyName, r.code, Number(r.salesGross), Number(r.commissionNet), Number(r.payoutNet)]),
      [24, 12, 18, 16, 16],
    );

    return workbookToBuffer(wb);
  }

  async topBrokersCsv(query: TopBrokersQueryDto) {
    const { data, metric } = await this.topBrokers(query);
    const headers = [
      'الوسيط',
      'الكود',
      'الحالة',
      'فرص',
      'فرص معتمدة',
      'حجوزات',
      'عقود',
      'عقود موقّعة',
      'إجمالي المبيعات',
      'إجمالي العمولات',
      'صافي العمولات',
      'صافي المدفوعات',
      'نسبة التحويل',
      'مرتب حسب',
    ];
    const rows = data.map((r) => [
      r.companyName,
      r.code,
      r.status,
      r.leads,
      r.approvedLeads,
      r.reservations,
      r.contracts,
      r.contractsSigned,
      r.salesGross,
      r.commissionGross,
      r.commissionNet,
      r.payoutNet,
      formatRate(r.conversionRate),
      metric,
    ]);
    return toCsv(headers, rows);
  }

  async brokerDetailCsv(brokerId: string, query: BrokerDetailReportQueryDto) {
    const detail = await this.brokerDetail(brokerId, query);
    const s = detail.summary;
    const headerRows: [string, string | number | null][] = [
      ['الوسيط', this.localizedName(detail.broker.companyName) ?? ''],
      ['الكود', detail.broker.code ?? ''],
      ['الحالة', detail.broker.status],
      ['', ''],
      ['الفترة من', query.from ?? ''],
      ['الفترة إلى', query.to ?? ''],
      ['', ''],
      ['فرص مرسلة', s.leadsSubmitted],
      ['فرص معتمدة', s.leadsApproved],
      ['حجوزات', s.reservationsCreated],
      ['عقود', s.contractsCreated],
      ['عقود موقّعة', s.contractsSigned],
      ['إجمالي المبيعات', s.salesGross],
      ['صافي العمولات', s.commissionsNet],
      ['صافي المدفوعات', s.payoutsTotalNet],
      ['نسبة الفرصة → الحجز', formatRate(s.leadToReservationRate)],
      ['نسبة الحجز → العقد', formatRate(s.reservationToContractRate)],
      ['نسبة العقد الموقّع', formatRate(s.signedContractRate)],
      ['نسبة العقد → الدفع', formatRate(s.contractToPaidPayoutRate)],
    ];

    const sections: string[] = [];
    sections.push(toCsv(['المؤشر', 'القيمة'], headerRows));

    if (detail.monthlyTrend.length > 0) {
      sections.push(
        toCsv(
          ['الشهر', 'حجوزات', 'عقود موقّعة', 'صافي العمولات', 'صافي المدفوعات'],
          detail.monthlyTrend.map((m) => [
            m.label,
            m.reservations,
            m.contractsSigned,
            m.commissionsNet,
            m.payoutsNet,
          ]),
        ),
      );
    }

    if (detail.agentBreakdown.length > 0) {
      sections.push(
        toCsv(
          [
            'الوكيل',
            'البريد',
            'الهاتف',
            'فرص',
            'حجوزات',
            'عقود',
            'عقود موقّعة',
            'إجمالي المبيعات',
            'صافي العمولات',
            'صافي المدفوعات',
          ],
          detail.agentBreakdown.map((a) => [
            a.fullName,
            a.email,
            a.phone,
            a.leadsSubmitted,
            a.reservations,
            a.contracts,
            a.contractsSigned,
            a.salesGross,
            a.commissionNet,
            a.payoutNet,
          ]),
        ),
      );
    }

    if (detail.projectBreakdown.length > 0) {
      sections.push(
        toCsv(
          [
            'المشروع',
            'المدينة',
            'عدد الوسطاء',
            'عقود',
            'عقود موقّعة',
            'إجمالي المبيعات',
            'صافي العمولات',
            'صافي المدفوعات',
          ],
          detail.projectBreakdown.map((p) => [
            this.localizedName(p.projectName),
            this.localizedName(p.city),
            p.brokerCount,
            p.contracts,
            p.contractsSigned,
            p.salesGross,
            p.commissionNet,
            p.payoutNet,
          ]),
        ),
      );
    }

    return sections.join('\r\n\r\n');
  }

  /**
   * P15.3 — styled XLSX twin of topBrokersCsv. Same real ranking + same filters
   * (sort metric, date range) surfaced in the sheet header. No demo values.
   */
  async topBrokersXlsx(query: TopBrokersQueryDto) {
    const { data, metric } = await this.topBrokers(query);
    const wb = createReportWorkbook();
    const ws = wb.addWorksheet('أعلى الوسطاء');
    addTitledTable(ws, {
      title: 'تقرير أعلى الوسطاء',
      filters: [
        ['مرتب حسب', TOP_METRIC_LABEL[metric] ?? metric],
        ['من', query.from ?? ''],
        ['إلى', query.to ?? ''],
      ],
      headers: [
        'الوسيط', 'الكود', 'الحالة', 'فرص', 'فرص معتمدة', 'حجوزات', 'عقود',
        'عقود موقّعة', 'إجمالي المبيعات', 'إجمالي العمولات', 'صافي العمولات',
        'صافي المدفوعات', 'نسبة التحويل',
      ],
      rows: data.map((r) => [
        r.companyName, r.code, r.status,
        r.leads, r.approvedLeads, r.reservations, r.contracts, r.contractsSigned,
        Number(r.salesGross), Number(r.commissionGross), Number(r.commissionNet),
        Number(r.payoutNet), formatRate(r.conversionRate),
      ]),
      widths: [22, 12, 12, 8, 11, 9, 8, 11, 16, 16, 14, 14, 12],
    });
    [9, 10, 11, 12].forEach((c) => (ws.getColumn(c).numFmt = '#,##0.##'));
    addFooter(ws);
    return workbookToBuffer(wb);
  }

  /**
   * P15.3 — styled XLSX twin of brokerDetailCsv. Same real detail (summary +
   * monthly trend + agent + project breakdowns) across one sheet per section.
   * No demo values.
   */
  async brokerDetailXlsx(brokerId: string, query: BrokerDetailReportQueryDto) {
    const detail = await this.brokerDetail(brokerId, query);
    const s = detail.summary;
    const wb = createReportWorkbook();

    const sum = wb.addWorksheet('الملخص');
    addTitledTable(sum, {
      title: `تقرير الوسيط — ${this.localizedName(detail.broker.companyName) || detail.broker.code || ''}`,
      filters: [
        ['الكود', detail.broker.code ?? ''],
        ['الحالة', detail.broker.status],
        ['من', query.from ?? ''],
        ['إلى', query.to ?? ''],
      ],
      headers: ['المؤشر', 'القيمة'],
      rows: [
        ['فرص مرسلة', s.leadsSubmitted],
        ['فرص معتمدة', s.leadsApproved],
        ['حجوزات', s.reservationsCreated],
        ['عقود', s.contractsCreated],
        ['عقود موقّعة', s.contractsSigned],
        ['إجمالي المبيعات', Number(s.salesGross)],
        ['صافي العمولات', Number(s.commissionsNet)],
        ['صافي المدفوعات', Number(s.payoutsTotalNet)],
        ['نسبة الفرصة → الحجز', formatRate(s.leadToReservationRate)],
        ['نسبة الحجز → العقد', formatRate(s.reservationToContractRate)],
        ['نسبة العقد الموقّع', formatRate(s.signedContractRate)],
        ['نسبة العقد → الدفع', formatRate(s.contractToPaidPayoutRate)],
      ],
      widths: [30, 18],
    });
    addFooter(sum);

    const trend = wb.addWorksheet('الاتجاه الشهري');
    addTable(
      trend,
      ['الشهر', 'حجوزات', 'عقود موقّعة', 'صافي العمولات', 'صافي المدفوعات'],
      detail.monthlyTrend.map((m) => [
        m.label, m.reservations, m.contractsSigned,
        Number(m.commissionsNet), Number(m.payoutsNet),
      ]),
      [16, 10, 12, 16, 16],
    );

    const agents = wb.addWorksheet('الوكلاء');
    addTable(
      agents,
      ['الوكيل', 'البريد', 'الهاتف', 'فرص', 'حجوزات', 'عقود', 'عقود موقّعة', 'إجمالي المبيعات', 'صافي العمولات', 'صافي المدفوعات'],
      detail.agentBreakdown.map((a) => [
        a.fullName, a.email ?? '', a.phone ?? '',
        a.leadsSubmitted, a.reservations, a.contracts, a.contractsSigned,
        Number(a.salesGross), Number(a.commissionNet), Number(a.payoutNet),
      ]),
      [22, 22, 16, 8, 9, 8, 11, 16, 16, 16],
    );

    const projects = wb.addWorksheet('المشاريع');
    addTable(
      projects,
      ['المشروع', 'المدينة', 'عدد الوسطاء', 'عقود', 'عقود موقّعة', 'إجمالي المبيعات', 'صافي العمولات', 'صافي المدفوعات'],
      detail.projectBreakdown.map((p) => [
        this.localizedName(p.projectName), this.localizedName(p.city),
        p.brokerCount, p.contracts, p.contractsSigned,
        Number(p.salesGross), Number(p.commissionNet), Number(p.payoutNet),
      ]),
      [24, 16, 12, 8, 11, 16, 16, 16],
    );

    return workbookToBuffer(wb);
  }

  private localizedName(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
      const v = value as Record<string, unknown>;
      const ar = typeof v.ar === 'string' ? v.ar : undefined;
      const en = typeof v.en === 'string' ? v.en : undefined;
      return ar || en || '';
    }
    return String(value);
  }

  // ── Internal helpers ────────────────────────────────────────────────────

  private parseRange(from?: string, to?: string) {
    return {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      inclusive: true,
    };
  }

  private dateRange(rangeFn: 'gte' | 'gt' = 'gte', r: Range) {
    if (!r.from && !r.to) return undefined;
    return {
      ...(r.from ? { [rangeFn]: r.from } : {}),
      ...(r.to ? { [r.inclusive ? 'lte' : 'lt']: r.to } : {}),
    } as Prisma.DateTimeFilter;
  }

  private leadWhere(filters: CommonFilters): Prisma.LeadWhereInput {
    return {
      NOT: { brokerId: null },
      ...(filters.brokerId ? { brokerId: filters.brokerId } : {}),
      ...(filters.brokerAgentId ? { brokerAgentId: filters.brokerAgentId } : {}),
      ...(filters.projectId ? { projectInterestId: filters.projectId } : {}),
      ...(this.dateRange('gte', filters.range)
        ? { createdAt: this.dateRange('gte', filters.range)! }
        : {}),
    };
  }

  private visitWhere(filters: CommonFilters): Prisma.VisitRequestWhereInput {
    return {
      NOT: { brokerId: null },
      ...(filters.brokerId ? { brokerId: filters.brokerId } : {}),
      ...(filters.brokerAgentId ? { brokerAgentId: filters.brokerAgentId } : {}),
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(this.dateRange('gte', filters.range)
        ? { createdAt: this.dateRange('gte', filters.range)! }
        : {}),
    };
  }

  private reservationCreatedWhere(filters: CommonFilters): Prisma.ReservationWhereInput {
    return {
      NOT: { brokerId: null },
      ...(filters.brokerId ? { brokerId: filters.brokerId } : {}),
      ...(filters.brokerAgentId ? { brokerAgentId: filters.brokerAgentId } : {}),
      ...(filters.projectId
        ? { unit: { building: { phase: { projectId: filters.projectId } } } }
        : {}),
      ...(this.dateRange('gte', filters.range)
        ? { createdAt: this.dateRange('gte', filters.range)! }
        : {}),
    };
  }

  private contractCreatedWhere(filters: CommonFilters): Prisma.ContractWhereInput {
    return {
      NOT: { brokerId: null },
      ...(filters.brokerId ? { brokerId: filters.brokerId } : {}),
      ...(filters.brokerAgentId ? { brokerAgentId: filters.brokerAgentId } : {}),
      ...(filters.projectId
        ? { unit: { building: { phase: { projectId: filters.projectId } } } }
        : {}),
      ...(this.dateRange('gte', filters.range)
        ? { createdAt: this.dateRange('gte', filters.range)! }
        : {}),
    };
  }

  private contractSignedWhere(filters: CommonFilters): Prisma.ContractWhereInput {
    return {
      NOT: { brokerId: null },
      ...(filters.brokerId ? { brokerId: filters.brokerId } : {}),
      ...(filters.brokerAgentId ? { brokerAgentId: filters.brokerAgentId } : {}),
      ...(filters.projectId
        ? { unit: { building: { phase: { projectId: filters.projectId } } } }
        : {}),
      signedAt: {
        not: null,
        ...(this.dateRange('gte', filters.range) ?? {}),
      },
    };
  }

  private commissionWhere(filters: {
    brokerId?: string;
    brokerAgentId?: string;
    projectId?: string;
    range: Range;
  }): Prisma.BrokerCommissionWhereInput {
    return {
      ...(filters.brokerId ? { brokerId: filters.brokerId } : {}),
      ...(filters.brokerAgentId ? { brokerAgentId: filters.brokerAgentId } : {}),
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(this.dateRange('gte', filters.range)
        ? { earnedAt: this.dateRange('gte', filters.range)! }
        : {}),
    };
  }

  private payoutCreatedWhere(filters: {
    brokerId?: string;
    range: Range;
  }): Prisma.BrokerPayoutWhereInput {
    return {
      ...(filters.brokerId ? { brokerId: filters.brokerId } : {}),
      ...(this.dateRange('gte', filters.range)
        ? { createdAt: this.dateRange('gte', filters.range)! }
        : {}),
    };
  }

  private payoutPaidWhere(filters: {
    brokerId?: string;
    range: Range;
  }): Prisma.BrokerPayoutWhereInput {
    return {
      ...(filters.brokerId ? { brokerId: filters.brokerId } : {}),
      status: BrokerPayoutStatus.PAID,
      paidAt: {
        not: null,
        ...(this.dateRange('gte', filters.range) ?? {}),
      },
    };
  }

  /**
   * Returns a bundle of pre-bound aggregate helpers reusing the same filters.
   * Each call returns a Prisma promise so the caller can fan them out with
   * Promise.all for one round of parallel queries.
   */
  private aggregateCommonCounts(filters: CommonFilters) {
    const leadW = this.leadWhere(filters);
    const visitW = this.visitWhere(filters);
    const resW = this.reservationCreatedWhere(filters);
    const conCreatedW = this.contractCreatedWhere(filters);
    const conSignedW = this.contractSignedWhere(filters);
    const commW = this.commissionWhere(filters);
    const payoutCreatedW = this.payoutCreatedWhere({ brokerId: filters.brokerId, range: filters.range });
    const payoutPaidW = this.payoutPaidWhere({ brokerId: filters.brokerId, range: filters.range });

    return {
      leadStats: async () => {
        const [submitted, approved, rejected, duplicate] = await Promise.all([
          this.prisma.lead.count({ where: leadW }),
          this.prisma.lead.count({ where: { ...leadW, brokerApprovalStatus: 'APPROVED' } }),
          this.prisma.lead.count({ where: { ...leadW, brokerApprovalStatus: 'REJECTED' } }),
          this.prisma.lead.count({ where: { ...leadW, brokerApprovalStatus: 'DUPLICATE' } }),
        ]);
        return {
          leadsSubmitted: submitted,
          leadsApproved: approved,
          leadsRejected: rejected,
          leadsDuplicate: duplicate,
        };
      },
      visitsRequested: () => this.prisma.visitRequest.count({ where: visitW }),
      reservationStats: async () => {
        const [created, approved, cancelled] = await Promise.all([
          this.prisma.reservation.count({ where: resW }),
          this.prisma.reservation.count({ where: { ...resW, status: 'APPROVED' } }),
          this.prisma.reservation.count({ where: { ...resW, status: 'CANCELLED' } }),
        ]);
        return {
          reservationsCreated: created,
          reservationsApproved: approved,
          reservationsCancelled: cancelled,
        };
      },
      contractStats: async () => {
        const [created, signed] = await Promise.all([
          this.prisma.contract.count({ where: conCreatedW }),
          this.prisma.contract.count({ where: conSignedW }),
        ]);
        return { contractsCreated: created, contractsSigned: signed };
      },
      salesGross: async () => {
        // Signed contracts only — see service-level comment for rationale.
        const agg = await this.prisma.contract.aggregate({
          _sum: { totalAmount: true },
          where: conSignedW,
        });
        return agg._sum.totalAmount ?? new Prisma.Decimal(0);
      },
      commissionStats: async () => {
        const [pending, approved, rejected, cancelled] = await Promise.all([
          this.prisma.brokerCommission.count({
            where: { ...commW, status: BrokerCommissionStatus.PENDING },
          }),
          this.prisma.brokerCommission.count({
            where: { ...commW, status: BrokerCommissionStatus.APPROVED },
          }),
          this.prisma.brokerCommission.count({
            where: { ...commW, status: BrokerCommissionStatus.REJECTED },
          }),
          this.prisma.brokerCommission.count({
            where: { ...commW, status: BrokerCommissionStatus.CANCELLED },
          }),
        ]);
        return {
          commissionsPending: pending,
          commissionsApproved: approved,
          commissionsRejected: rejected,
          commissionsCancelled: cancelled,
        };
      },
      commissionTotals: async () => {
        const activeCommW = {
          ...commW,
          status: { notIn: [BrokerCommissionStatus.CANCELLED, BrokerCommissionStatus.REJECTED] },
        };
        const [allAgg, pendingAgg] = await Promise.all([
          this.prisma.brokerCommission.aggregate({
            _sum: { grossAmount: true, netAmount: true },
            where: activeCommW,
          }),
          this.prisma.brokerCommission.aggregate({
            _sum: { netAmount: true },
            where: { ...commW, status: BrokerCommissionStatus.PENDING },
          }),
        ]);
        return {
          gross: allAgg._sum.grossAmount ?? new Prisma.Decimal(0),
          net: allAgg._sum.netAmount ?? new Prisma.Decimal(0),
          pendingNet: pendingAgg._sum.netAmount ?? new Prisma.Decimal(0),
        };
      },
      payoutStats: async () => {
        const [draft, approved, processing, paid] = await Promise.all([
          this.prisma.brokerPayout.count({
            where: { ...payoutCreatedW, status: BrokerPayoutStatus.DRAFT },
          }),
          this.prisma.brokerPayout.count({
            where: { ...payoutCreatedW, status: BrokerPayoutStatus.APPROVED },
          }),
          this.prisma.brokerPayout.count({
            where: { ...payoutCreatedW, status: BrokerPayoutStatus.PROCESSING },
          }),
          // Paid count uses paidAt for date-range consistency with the total.
          this.prisma.brokerPayout.count({ where: payoutPaidW }),
        ]);
        return {
          payoutsDraft: draft,
          payoutsApproved: approved,
          payoutsProcessing: processing,
          payoutsPaid: paid,
        };
      },
      payoutPaidTotal: async () => {
        const agg = await this.prisma.brokerPayout.aggregate({
          _sum: { totalNet: true },
          where: payoutPaidW,
        });
        return agg._sum.totalNet ?? new Prisma.Decimal(0);
      },
    };
  }

  private computeRates(s: {
    leadsApproved: number;
    reservationsCreated: number;
    contractsCreated: number;
    contractsSigned: number;
    commissionsApproved: number;
    payoutsPaid: number;
  }) {
    return {
      leadToReservationRate: rate(s.reservationsCreated, s.leadsApproved),
      reservationToContractRate: rate(s.contractsCreated, s.reservationsCreated),
      signedContractRate: rate(s.contractsSigned, s.contractsCreated),
      contractToPaidPayoutRate: rate(s.payoutsPaid, s.contractsSigned),
    };
  }

  private async projectBreakdownForBroker(args: { brokerId: string; range: Range }) {
    const projectsRes = await this.projects({
      brokerId: args.brokerId,
      from: args.range.from?.toISOString(),
      to: args.range.to?.toISOString(),
    });
    return projectsRes.data;
  }

  private async recent(args: { brokerId: string; range: Range }) {
    const dateRange = this.dateRange('gte', args.range);
    const where = (extra: object) => ({
      brokerId: args.brokerId,
      ...extra,
    });

    const [leads, reservations, contracts, commissions, payouts] = await Promise.all([
      this.prisma.lead.findMany({
        where: where(dateRange ? { createdAt: dateRange } : {}),
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          fullName: true,
          phone: true,
          stage: true,
          brokerApprovalStatus: true,
          createdAt: true,
          projectInterest: { select: { id: true, name: true } },
        },
      }),
      this.prisma.reservation.findMany({
        where: where(dateRange ? { createdAt: dateRange } : {}),
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          reservationNumber: true,
          status: true,
          createdAt: true,
          unit: { select: { id: true, code: true } },
        },
      }),
      this.prisma.contract.findMany({
        where: where(dateRange ? { createdAt: dateRange } : {}),
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          contractNumber: true,
          signedAt: true,
          totalAmount: true,
          createdAt: true,
          unit: { select: { id: true, code: true } },
        },
      }),
      this.prisma.brokerCommission.findMany({
        where: where(dateRange ? { earnedAt: dateRange } : {}),
        orderBy: { earnedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          commissionNumber: true,
          status: true,
          grossAmount: true,
          netAmount: true,
          earnedAt: true,
        },
      }),
      this.prisma.brokerPayout.findMany({
        where: where(dateRange ? { createdAt: dateRange } : {}),
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          payoutNumber: true,
          status: true,
          period: true,
          totalNet: true,
          createdAt: true,
          paidAt: true,
        },
      }),
    ]);
    return { leads, reservations, contracts, commissions, payouts };
  }
}

interface Range {
  from?: Date;
  to?: Date;
  inclusive: boolean;
}

interface CommonFilters {
  brokerId?: string;
  brokerAgentId?: string;
  projectId?: string;
  range: Range;
}

function rate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 10_000) / 10_000;
}

function formatRate(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}
