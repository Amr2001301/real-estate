import {
  Controller,
  Get,
  Header,
  Injectable,
  Module,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import {
  BonusEntryStatus,
  BrokerCommissionStatus,
  BrokerPayoutStatus,
  DepositType,
  DocumentCategory,
  DocumentOwnerType,
  InstallmentStatus,
  Prisma,
  ReservationStatus,
  UnitStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { toCsv, type CsvCell } from '../../common/utils/csv';

@Injectable()
class ReportsService {
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

  async sales(period?: string) {
    // period: YYYY-MM
    const where: Prisma.ContractWhereInput = period
      ? this.periodWhereContract(period)
      : {};
    const [count, totalAmount, byProject] = await this.prisma.$transaction([
      this.prisma.contract.count({ where }),
      this.prisma.contract.aggregate({ where, _sum: { totalAmount: true } }),
      this.prisma.$queryRawUnsafe<Array<{ projectId: string; total: number; count: number }>>(`
        SELECT p.id as "projectId", COUNT(c.*)::int as count, COALESCE(SUM(c."totalAmount"), 0)::float as total
        FROM "Contract" c
        JOIN "Unit" u ON u.id = c."unitId"
        JOIN "Building" b ON b.id = u."buildingId"
        JOIN "Phase" ph ON ph.id = b."phaseId"
        JOIN "Project" p ON p.id = ph."projectId"
        ${period ? `WHERE to_char(c."createdAt", 'YYYY-MM') = '${period.replace(/[^0-9-]/g, '')}'` : ''}
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

  async financial(period?: string) {
    const where: Prisma.DepositWhereInput = period
      ? this.periodWhereDeposit(period)
      : {};
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

  async reservations() {
    const groups = await this.prisma.reservation.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    return groups.reduce<Record<string, number>>(
      (acc, g) => ((acc[g.status] = g._count._all), acc),
      {},
    );
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
    };
  }

  // ── CSV builders ─────────────────────────────────────────────────────────
  // Each builder takes the already-computed report payload and emits a CSV
  // string with a UTF-8 BOM (Excel-friendly Arabic). Reuses the service's
  // existing data methods — no new business logic.

  async salesCsv(period?: string): Promise<string> {
    const data = await this.sales(period);

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

  async financialCsv(period?: string): Promise<string> {
    const data = await this.financial(period);
    const rows: CsvCell[][] = [
      ['الفترة', period ?? 'الكل'],
      ['عدد الدفعات', data.deposits],
      ['الدفعات الموثّقة', data.verified],
      ['إجمالي المبالغ المحصّلة', Number(data.total).toFixed(2)],
    ];
    return toCsv(['المؤشر', 'القيمة'], rows);
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

class FinancialDashboardQueryDto {
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsEnum(DepositType) type?: DepositType;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
}

@ApiTags('reports')
@Controller('reports')
class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  @Roles(UserRole.ADMIN)
  @Permissions('reports:operational:read')
  @Get('kpis')
  kpis() {
    return this.svc.kpis();
  }

  @Roles(UserRole.ADMIN)
  @Permissions('reports:sales:read')
  @Get('sales')
  sales(@Query('period') period?: string) {
    return this.svc.sales(period);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('reports:financial:read')
  @Get('financial')
  financial(@Query('period') period?: string) {
    return this.svc.financial(period);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('reports:operational:read')
  @Get('reservations')
  reservations() {
    return this.svc.reservations();
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
  salesCsv(@Query('period') period?: string) {
    return this.svc.salesCsv(period);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('reports:financial:read')
  @Get('financial/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="financial-report.csv"')
  financialCsv(@Query('period') period?: string) {
    return this.svc.financialCsv(period);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('reports:operational:read')
  @Get('operational/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="operational-report.csv"')
  operationalCsv() {
    return this.svc.operationalCsv();
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
}

@Module({
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
