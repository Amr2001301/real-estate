/**
 * Receivables & payables (المستحقات والالتزامات) — what the company is owed and what it owes, on one page.
 *
 * Receivables (ليا): open schedule rows of signed live contracts (price rows
 * — down payment, monthly, final, a booking moved into the schedule — and,
 * apart, fees and penalties), bookings still unpaid on open reservations,
 * and clawbacks owed back by brokers and sales.
 *
 * Payables (عليا): broker commissions (approved and not paid out, or waiting
 * for approval), price-change top-ups not paid yet, sales bonuses not paid,
 * and refunds agreed on cancelled contracts not paid back. What a MANUAL
 * cancellation left for the admin's decision is shown apart, in no total.
 *
 * Money owed is late from the day it became owed: a schedule row after its
 * due day; a commission, bonus or top-up from its approval (decided
 * 2026-10-22 — approved and not paid is already late); a refund from the
 * cancellation; a clawback from the cancellation that opened it. Waiting for
 * approval is shown apart, dated by its creation. The amounts are those of
 * the financial report (same definitions), so the two always agree.
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import {
  BonusEntryStatus,
  BrokerCommissionAdjustmentKind,
  BrokerCommissionStatus,
  BrokerPayoutStatus,
  ClawbackStatus,
  ContractStatus,
  InstallmentStatus,
  PlanPaymentType,
  Prisma,
  ReservationBookingPaymentStatus,
  ReservationStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getRequiredCompanyId, getTenantContext } from '../../common/tenant/tenant-context';
import { currentCompanyTimeZone, startOfLocalToday } from '../../common/time/company-timezone';
import { reportRange } from '../../common/time/report-range';
import {
  LIVE_CONTRACT_WHERE,
  LIVE_PLAN_WHERE,
  PAYABLE_DEAL_WHERE,
  PAYMENT_ON_ITS_WAY,
  SURCHARGE_PAYMENT_TYPES,
} from '../installments/live-contract';

export const RECEIVABLE_GROUPS = ['installments', 'bookings', 'fees', 'clawbacks'] as const;
export const PAYABLE_GROUPS = ['commissions', 'topUps', 'bonuses', 'refunds', 'onHold'] as const;
export type LedgerGroup = (typeof RECEIVABLE_GROUPS)[number] | (typeof PAYABLE_GROUPS)[number];

/** Where a row stands: by its due day, on its way, or waiting for approval. */
export type LedgerState = 'late' | 'dueToday' | 'upcoming' | 'onItsWay' | 'pendingApproval';

export interface LedgerFilter {
  dateFrom?: string;
  dateTo?: string;
  projectId?: string;
  q?: string;
}

export interface LedgerRow {
  id: string;
  group: LedgerGroup;
  /** Row type: schedule row type, or COMMISSION / BONUS / TOP_UP / REFUND / BOOKING / CLAWBACK. */
  type: string;
  date: string | null;
  amount: string;
  state: LedgerState;
  party: { kind: 'customer' | 'client' | 'broker' | 'sales'; id: string | null; name: string | null } | null;
  contract: { id: string; number: string | null } | null;
  unit: { id: string; code: string } | null;
  reservation: { id: string; number: string | null } | null;
  /** The record itself when it has its own page (commission, payout, cancellation…). */
  ref: { kind: 'commission' | 'payout' | 'installment' | 'reservation' | 'contract'; id: string; code: string | null } | null;
  payout: { id: string; number: string | null } | null;
}

const D = (v: Prisma.Decimal | number | string | null | undefined) => new Prisma.Decimal(v ?? 0);
const ZERO = new Prisma.Decimal(0);
const DAY = 24 * 60 * 60 * 1000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const OPEN_ROW: InstallmentStatus[] = [InstallmentStatus.PENDING, InstallmentStatus.OVERDUE];
const UNSENT_PAYOUT: BrokerPayoutStatus[] = [BrokerPayoutStatus.DRAFT, BrokerPayoutStatus.APPROVED];
const OWED_CLAWBACK = { in: [ClawbackStatus.OUTSTANDING, ClawbackStatus.PARTIALLY_COLLECTED] };

/** The financial report's signed live plans. */
const SIGNED_PLAN_WHERE = {
  ...LIVE_PLAN_WHERE,
  contract: { ...LIVE_CONTRACT_WHERE, signedAt: { not: null } },
} satisfies Prisma.InstallmentPlanWhereInput;

const UNIT_SELECT = { id: true, code: true } as const;
const CONTRACT_REF = {
  id: true,
  contractNumber: true,
  unit: { select: UNIT_SELECT },
  customer: { select: { id: true, fullName: true } },
} as const;

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  private async context(f: LedgerFilter) {
    for (const d of [f.dateFrom, f.dateTo]) {
      if (d && !DATE_ONLY.test(d)) throw new BadRequestException('التاريخ بصيغة YYYY-MM-DD');
    }
    if (f.dateFrom && f.dateTo && f.dateFrom > f.dateTo) throw new BadRequestException('بداية الفترة بعد نهايتها');
    const companyId = getRequiredCompanyId();
    const tz = await currentCompanyTimeZone(this.prisma, getTenantContext()?.companyId);
    const today = startOfLocalToday(tz);
    // Due days are calendar dates stored as UTC midnight; instants use local midnight.
    const dueRange: { gte?: Date; lt?: Date } = {};
    if (f.dateFrom) dueRange.gte = new Date(`${f.dateFrom}T00:00:00Z`);
    if (f.dateTo) dueRange.lt = new Date(new Date(`${f.dateTo}T00:00:00Z`).getTime() + DAY);
    const at = f.dateFrom || f.dateTo ? reportRange(f.dateFrom, f.dateTo, tz) : undefined;
    return { companyId, today, dueRange: f.dateFrom || f.dateTo ? dueRange : undefined, at };
  }

  // ── Where clauses, shared by the totals and the rows ─────────────────────

  private rowWhere(f: LedgerFilter, c: Awaited<ReturnType<LedgerService['context']>>, fees: boolean) {
    const and: Prisma.InstallmentWhereInput[] = [
      { companyId: c.companyId, plan: SIGNED_PLAN_WHERE, status: { in: OPEN_ROW } },
      { type: fees ? { in: SURCHARGE_PAYMENT_TYPES } : { notIn: SURCHARGE_PAYMENT_TYPES } },
    ];
    if (c.dueRange) and.push({ dueDate: c.dueRange });
    if (f.projectId) and.push({ plan: { contract: { unit: { building: { phase: { projectId: f.projectId } } } } } });
    if (f.q) {
      const q = { contains: f.q, mode: Prisma.QueryMode.insensitive };
      and.push({
        plan: {
          contract: {
            OR: [{ customer: { fullName: q } }, { contractNumber: q }, { unit: { code: q } }],
          },
        },
      });
    }
    return and;
  }

  private rowStates(today: Date): Record<'late' | 'dueToday' | 'upcoming' | 'onItsWay', Prisma.InstallmentWhereInput> {
    const none = { deposits: { none: PAYMENT_ON_ITS_WAY } };
    return {
      late: { ...none, dueDate: { lt: today } },
      dueToday: { ...none, dueDate: { gte: today, lt: new Date(today.getTime() + DAY) } },
      upcoming: { ...none, dueDate: { gte: new Date(today.getTime() + DAY) } },
      onItsWay: { deposits: { some: PAYMENT_ON_ITS_WAY } },
    };
  }

  private bookingWhere(f: LedgerFilter, c: Awaited<ReturnType<LedgerService['context']>>): Prisma.ReservationWhereInput {
    const and: Prisma.ReservationWhereInput[] = [
      {
        companyId: c.companyId,
        status: { in: [ReservationStatus.PENDING, ReservationStatus.APPROVED] },
        bookingPaymentStatus: { in: [ReservationBookingPaymentStatus.UNPAID, ReservationBookingPaymentStatus.PENDING] },
        bookingAmount: { gt: 0 },
      },
    ];
    if (c.at) and.push({ createdAt: c.at });
    if (f.projectId) and.push({ unit: { building: { phase: { projectId: f.projectId } } } });
    if (f.q) {
      const q = { contains: f.q, mode: Prisma.QueryMode.insensitive };
      and.push({ OR: [{ client: { fullName: q } }, { lead: { fullName: q } }, { reservationNumber: q }, { unit: { code: q } }] });
    }
    return { AND: and };
  }

  private commissionWhere(f: LedgerFilter, c: Awaited<ReturnType<LedgerService['context']>>) {
    const and: Prisma.BrokerCommissionWhereInput[] = [{ companyId: c.companyId }];
    if (f.projectId) and.push({ projectId: f.projectId });
    if (f.q) {
      const q = { contains: f.q, mode: Prisma.QueryMode.insensitive };
      and.push({
        OR: [
          { commissionNumber: q },
          { broker: { companyName: q } },
          { broker: { commercialName: q } },
          { contract: { contractNumber: q } },
          { unit: { code: q } },
        ],
      });
    }
    return {
      // Owed from its approval (an old one with no approval date: from when it was earned).
      late: {
        AND: [
          ...and,
          { status: BrokerCommissionStatus.APPROVED },
          PAYABLE_DEAL_WHERE,
          { OR: [{ payoutId: null }, { payout: { status: { not: BrokerPayoutStatus.PAID } } }] },
          ...(c.at ? [{ OR: [{ approvedAt: c.at }, { approvedAt: null, earnedAt: c.at }] }] : []),
        ],
      },
      pendingApproval: {
        AND: [...and, { status: BrokerCommissionStatus.PENDING }, PAYABLE_DEAL_WHERE, ...(c.at ? [{ earnedAt: c.at }] : [])],
      },
      onHold: {
        AND: [
          ...and,
          ...(c.at ? [{ earnedAt: c.at }] : []),
          { status: { in: [BrokerCommissionStatus.PENDING, BrokerCommissionStatus.APPROVED] } },
          { contract: { status: ContractStatus.CANCELLED }, retainedOnCancellation: false, clawbackStatus: null },
        ],
      },
    } satisfies Record<string, Prisma.BrokerCommissionWhereInput>;
  }

  private bonusWhere(f: LedgerFilter, c: Awaited<ReturnType<LedgerService['context']>>) {
    const and: Prisma.BonusEntryWhereInput[] = [{ companyId: c.companyId }];
    if (f.projectId) and.push({ contract: { unit: { building: { phase: { projectId: f.projectId } } } } });
    if (f.q) {
      const q = { contains: f.q, mode: Prisma.QueryMode.insensitive };
      and.push({ OR: [{ sales: { fullName: q } }, { contract: { contractNumber: q } }] });
    }
    const payable: Prisma.BonusEntryWhereInput = {
      OR: [{ contractId: null }, { contract: LIVE_CONTRACT_WHERE }, { retainedOnCancellation: true }],
    };
    return {
      late: {
        AND: [
          ...and,
          { status: BonusEntryStatus.APPROVED },
          payable,
          ...(c.at ? [{ OR: [{ approvedAt: c.at }, { approvedAt: null, createdAt: c.at }] }] : []),
        ],
      },
      pendingApproval: { AND: [...and, { status: BonusEntryStatus.PENDING }, payable, ...(c.at ? [{ createdAt: c.at }] : [])] },
      onHold: {
        AND: [
          ...and,
          ...(c.at ? [{ createdAt: c.at }] : []),
          { status: { not: BonusEntryStatus.CANCELLED } },
          { contract: { status: ContractStatus.CANCELLED }, retainedOnCancellation: false, clawbackStatus: null },
        ],
      },
    } satisfies Record<string, Prisma.BonusEntryWhereInput>;
  }

  private topUpWhere(f: LedgerFilter, c: Awaited<ReturnType<LedgerService['context']>>): Prisma.BrokerCommissionAdjustmentWhereInput {
    const and: Prisma.BrokerCommissionAdjustmentWhereInput[] = [
      {
        companyId: c.companyId,
        kind: BrokerCommissionAdjustmentKind.TOP_UP,
        settlesClawback: false,
        OR: [{ payoutId: null }, { payout: { status: { not: BrokerPayoutStatus.PAID } } }],
        commission: PAYABLE_DEAL_WHERE,
      },
    ];
    if (c.at) and.push({ createdAt: c.at });
    if (f.projectId) and.push({ commission: { projectId: f.projectId } });
    if (f.q) {
      const q = { contains: f.q, mode: Prisma.QueryMode.insensitive };
      and.push({ OR: [{ broker: { companyName: q } }, { broker: { commercialName: q } }, { commission: { commissionNumber: q } }] });
    }
    return { AND: and };
  }

  private cancellationWhere(f: LedgerFilter, c: Awaited<ReturnType<LedgerService['context']>>): Prisma.ContractCancellationWhereInput {
    const and: Prisma.ContractCancellationWhereInput[] = [{ companyId: c.companyId, refundAmount: { gt: 0 } }];
    if (c.at) and.push({ cancellationDate: c.at });
    if (f.projectId) and.push({ contract: { unit: { building: { phase: { projectId: f.projectId } } } } });
    if (f.q) {
      const q = { contains: f.q, mode: Prisma.QueryMode.insensitive };
      and.push({ contract: { OR: [{ customer: { fullName: q } }, { contractNumber: q }, { unit: { code: q } }] } });
    }
    return { AND: and };
  }

  // ── Lists that need a figure computed per record ───────────────────────

  /** Refunds still owed: agreed on the cancellation less what was paid back. */
  private async refundRows(f: LedgerFilter, c: Awaited<ReturnType<LedgerService['context']>>): Promise<LedgerRow[]> {
    const rows = await this.prisma.contractCancellation.findMany({
      where: this.cancellationWhere(f, c),
      orderBy: { cancellationDate: 'asc' },
      select: {
        id: true,
        cancellationDate: true,
        refundAmount: true,
        refunds: { select: { amount: true } },
        contract: { select: CONTRACT_REF },
      },
    });
    return rows.flatMap((r) => {
      const left = D(r.refundAmount).minus(r.refunds.reduce((s, x) => s.plus(x.amount), ZERO));
      if (!left.isPositive()) return [];
      return [
        {
          id: r.id,
          group: 'refunds' as const,
          type: 'REFUND',
          date: r.cancellationDate.toISOString(),
          amount: left.toString(),
          state: 'late' as const,
          party: { kind: 'customer' as const, id: r.contract.customer?.id ?? null, name: r.contract.customer?.fullName ?? null },
          contract: { id: r.contract.id, number: r.contract.contractNumber },
          unit: r.contract.unit,
          reservation: null,
          ref: { kind: 'contract' as const, id: r.contract.id, code: r.contract.contractNumber },
          payout: null,
        },
      ];
    });
  }

  /** Clawbacks owed back: a cancelled deal's paid commission or bonus, and price-change clawbacks not netted yet. */
  private async clawbackRows(f: LedgerFilter, c: Awaited<ReturnType<LedgerService['context']>>): Promise<LedgerRow[]> {
    const q = f.q ? { contains: f.q, mode: Prisma.QueryMode.insensitive } : undefined;
    const [commissions, bonuses, adjustments] = await Promise.all([
      this.prisma.brokerCommission.findMany({
        where: {
          companyId: c.companyId,
          clawbackStatus: OWED_CLAWBACK,
          ...(f.projectId ? { projectId: f.projectId } : {}),
          ...(c.at ? { clawbackAt: c.at } : {}),
          ...(q ? { OR: [{ commissionNumber: q }, { broker: { companyName: q } }, { broker: { commercialName: q } }] } : {}),
        },
        select: {
          id: true,
          commissionNumber: true,
          netAmount: true,
          clawbackAmount: true,
          clawbackCollectedAmount: true,
          clawbackAt: true,
          broker: { select: { id: true, companyName: true, commercialName: true } },
          contract: { select: CONTRACT_REF },
        },
      }),
      // A bonus has no project of its own; with a project filter it is
      // matched through its contract.
      this.prisma.bonusEntry.findMany({
        where: {
          companyId: c.companyId,
          clawbackStatus: OWED_CLAWBACK,
          ...(f.projectId ? { contract: { unit: { building: { phase: { projectId: f.projectId } } } } } : {}),
          ...(c.at ? { clawbackAt: c.at } : {}),
          ...(q ? { sales: { fullName: q } } : {}),
        },
        select: {
          id: true,
          amount: true,
          clawbackAmount: true,
          clawbackCollectedAmount: true,
          clawbackAt: true,
          sales: { select: { id: true, fullName: true } },
          contract: { select: CONTRACT_REF },
        },
      }),
      this.prisma.brokerCommissionAdjustment.findMany({
        where: {
          companyId: c.companyId,
          kind: BrokerCommissionAdjustmentKind.CLAWBACK,
          settlesClawback: false,
          OR: [{ payoutId: null }, { payout: { status: { in: UNSENT_PAYOUT } } }],
          commission: {
            ...PAYABLE_DEAL_WHERE,
            ...(f.projectId ? { projectId: f.projectId } : {}),
          },
          ...(c.at ? { createdAt: c.at } : {}),
          ...(q ? { OR: [{ broker: { companyName: q } }, { broker: { commercialName: q } }] } : {}),
        },
        select: {
          id: true,
          amount: true,
          createdAt: true,
          broker: { select: { id: true, companyName: true, commercialName: true } },
          commission: { select: { id: true, commissionNumber: true, contract: { select: CONTRACT_REF } } },
        },
      }),
    ]);
    const left = (full: Prisma.Decimal, collected: Prisma.Decimal | null) => full.minus(collected ?? ZERO);
    const out: LedgerRow[] = [];
    for (const r of commissions) {
      const amount = left(r.clawbackAmount ?? r.netAmount, r.clawbackCollectedAmount);
      if (!amount.isPositive()) continue;
      out.push({
        id: r.id,
        group: 'clawbacks',
        type: 'COMMISSION_CLAWBACK',
        date: r.clawbackAt?.toISOString() ?? null,
        amount: amount.toString(),
        state: 'late',
        party: { kind: 'broker', id: r.broker.id, name: r.broker.commercialName ?? r.broker.companyName },
        contract: { id: r.contract.id, number: r.contract.contractNumber },
        unit: r.contract.unit,
        reservation: null,
        ref: { kind: 'commission', id: r.id, code: r.commissionNumber },
        payout: null,
      });
    }
    for (const r of bonuses) {
      const amount = left(r.clawbackAmount ?? r.amount, r.clawbackCollectedAmount);
      if (!amount.isPositive()) continue;
      out.push({
        id: r.id,
        group: 'clawbacks',
        type: 'BONUS_CLAWBACK',
        date: r.clawbackAt?.toISOString() ?? null,
        amount: amount.toString(),
        state: 'late',
        party: { kind: 'sales', id: r.sales.id, name: r.sales.fullName },
        contract: r.contract ? { id: r.contract.id, number: r.contract.contractNumber } : null,
        unit: r.contract?.unit ?? null,
        reservation: null,
        ref: null,
        payout: null,
      });
    }
    for (const r of adjustments) {
      out.push({
        id: r.id,
        group: 'clawbacks',
        type: 'PRICE_CHANGE_CLAWBACK',
        date: r.createdAt.toISOString(),
        amount: D(r.amount).toString(),
        state: 'late',
        party: { kind: 'broker', id: r.broker.id, name: r.broker.commercialName ?? r.broker.companyName },
        contract: { id: r.commission.contract.id, number: r.commission.contract.contractNumber },
        unit: r.commission.contract.unit,
        reservation: null,
        ref: { kind: 'commission', id: r.commission.id, code: r.commission.commissionNumber },
        payout: null,
      });
    }
    return out.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  }

  // ── Totals ──────────────────────────────────────────────────────────────

  async summary(f: LedgerFilter) {
    const c = await this.context(f);
    const states = this.rowStates(c.today);
    const priceRows = this.rowWhere(f, c, false);
    const feeRows = this.rowWhere(f, c, true);
    const commission = this.commissionWhere(f, c);
    const bonus = this.bonusWhere(f, c);
    const sumRows = (and: Prisma.InstallmentWhereInput[], extra: Prisma.InstallmentWhereInput = {}) =>
      this.prisma.installment.aggregate({ where: { AND: [...and, extra] }, _sum: { amount: true }, _count: { _all: true } });
    const fig = (agg: { _sum: { amount?: Prisma.Decimal | null; netAmount?: Prisma.Decimal | null; bookingAmount?: Prisma.Decimal | null }; _count: { _all: number } }) => ({
      amount: D(agg._sum.amount ?? agg._sum.netAmount ?? agg._sum.bookingAmount).toString(),
      count: agg._count._all,
    });
    const bookingWhere = this.bookingWhere(f, c);

    const [
      priceAll, priceLate, priceToday, priceUpcoming, priceOnWay, priceTypes,
      feeAll, feeLate, feeToday, feeUpcoming, feeOnWay,
      bookingUnpaid, bookingPending,
      commissionDue, commissionPending, commissionOnHold,
      bonusDue, bonusPending, bonusOnHold,
      topUps,
      refunds,
      clawbacks,
    ] = await Promise.all([
      sumRows(priceRows),
      sumRows(priceRows, states.late),
      sumRows(priceRows, states.dueToday),
      sumRows(priceRows, states.upcoming),
      sumRows(priceRows, states.onItsWay),
      this.prisma.installment.groupBy({ by: ['type'], where: { AND: priceRows }, _sum: { amount: true }, _count: { _all: true } }),
      sumRows(feeRows),
      sumRows(feeRows, states.late),
      sumRows(feeRows, states.dueToday),
      sumRows(feeRows, states.upcoming),
      sumRows(feeRows, states.onItsWay),
      this.prisma.reservation.aggregate({
        where: { AND: [bookingWhere, { bookingPaymentStatus: ReservationBookingPaymentStatus.UNPAID }] },
        _sum: { bookingAmount: true },
        _count: { _all: true },
      }),
      this.prisma.reservation.aggregate({
        where: { AND: [bookingWhere, { bookingPaymentStatus: ReservationBookingPaymentStatus.PENDING }] },
        _sum: { bookingAmount: true },
        _count: { _all: true },
      }),
      this.prisma.brokerCommission.aggregate({ where: commission.late, _sum: { netAmount: true }, _count: { _all: true } }),
      this.prisma.brokerCommission.aggregate({ where: commission.pendingApproval, _sum: { netAmount: true }, _count: { _all: true } }),
      this.prisma.brokerCommission.aggregate({ where: commission.onHold, _sum: { netAmount: true }, _count: { _all: true } }),
      this.prisma.bonusEntry.aggregate({ where: bonus.late, _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.bonusEntry.aggregate({ where: bonus.pendingApproval, _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.bonusEntry.aggregate({ where: bonus.onHold, _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.brokerCommissionAdjustment.aggregate({ where: this.topUpWhere(f, c), _sum: { amount: true }, _count: { _all: true } }),
      this.refundRows(f, c),
      this.clawbackRows(f, c),
    ]);

    const sum = (...xs: Array<{ amount: string }>) => xs.reduce((s, x) => s.plus(x.amount), ZERO);
    const listFig = (rows: LedgerRow[]) => ({ amount: sum(...rows).toString(), count: rows.length });

    const installments = {
      ...fig(priceAll),
      states: { late: fig(priceLate), dueToday: fig(priceToday), upcoming: fig(priceUpcoming), onItsWay: fig(priceOnWay) },
      types: Object.fromEntries(priceTypes.map((t) => [t.type, { amount: D(t._sum.amount).toString(), count: t._count._all }])),
    };
    const fees = {
      ...fig(feeAll),
      states: { late: fig(feeLate), dueToday: fig(feeToday), upcoming: fig(feeUpcoming), onItsWay: fig(feeOnWay) },
    };
    const bookingsUnpaid = fig(bookingUnpaid);
    const bookingsOnWay = fig(bookingPending);
    const bookings = {
      amount: sum(bookingsUnpaid, bookingsOnWay).toString(),
      count: bookingsUnpaid.count + bookingsOnWay.count,
      states: { late: bookingsUnpaid, onItsWay: bookingsOnWay },
    };
    const clawbackFig = listFig(clawbacks);

    const commissionsFig = {
      late: fig(commissionDue),
      pendingApproval: fig(commissionPending),
    };
    const commissions = {
      amount: sum(commissionsFig.late, commissionsFig.pendingApproval).toString(),
      count: commissionsFig.late.count + commissionsFig.pendingApproval.count,
      states: commissionsFig,
    };
    const bonusesFig = { late: fig(bonusDue), pendingApproval: fig(bonusPending) };
    const bonuses = {
      amount: sum(bonusesFig.late, bonusesFig.pendingApproval).toString(),
      count: bonusesFig.late.count + bonusesFig.pendingApproval.count,
      states: bonusesFig,
    };
    const topUpFig = fig(topUps);
    const refundFig = listFig(refunds);
    const onHold = {
      commissions: fig(commissionOnHold),
      bonuses: fig(bonusOnHold),
    };

    const receivablesTotal = sum(installments, fees, bookings, clawbackFig);
    const payablesTotal = sum(commissions, bonuses, topUpFig, refundFig);
    return {
      asOf: c.today.toISOString().slice(0, 10),
      filter: { dateFrom: f.dateFrom ?? null, dateTo: f.dateTo ?? null, projectId: f.projectId ?? null },
      receivables: {
        total: receivablesTotal.toString(),
        groups: { installments, bookings, fees, clawbacks: clawbackFig },
      },
      payables: {
        total: payablesTotal.toString(),
        groups: { commissions, topUps: topUpFig, bonuses, refunds: refundFig },
        /** Left by a MANUAL cancellation for the admin's decision: in no total. */
        onHold: {
          amount: sum(onHold.commissions, onHold.bonuses).toString(),
          count: onHold.commissions.count + onHold.bonuses.count,
          ...onHold,
        },
      },
      net: receivablesTotal.minus(payablesTotal).toString(),
    };
  }

  // ── Rows of one group ───────────────────────────────────────────────────

  async rows(f: LedgerFilter & { group: LedgerGroup; state?: LedgerState; page: number; pageSize: number }) {
    const c = await this.context(f);
    const skip = (f.page - 1) * f.pageSize;
    const take = f.pageSize;
    const page = (data: LedgerRow[], total: number) => ({
      data,
      meta: { page: f.page, pageSize: f.pageSize, total, totalPages: Math.max(1, Math.ceil(total / f.pageSize)) },
    });
    const inMemory = (all: LedgerRow[]) => page(all.slice(skip, skip + take), all.length);

    switch (f.group) {
      case 'installments':
      case 'fees': {
        const states = this.rowStates(c.today);
        const and = this.rowWhere(f, c, f.group === 'fees');
        if (f.state && f.state in states) and.push(states[f.state as keyof typeof states]);
        const where = { AND: and };
        const [rows, total] = await Promise.all([
          this.prisma.installment.findMany({
            where,
            orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
            skip,
            take,
            select: {
              id: true,
              type: true,
              dueDate: true,
              amount: true,
              deposits: { where: PAYMENT_ON_ITS_WAY, select: { id: true }, take: 1 },
              plan: { select: { contract: { select: { ...CONTRACT_REF, reservation: { select: { id: true, reservationNumber: true } } } } } },
            },
          }),
          this.prisma.installment.count({ where }),
        ]);
        return page(
          rows.map((r) => {
            const ct = r.plan.contract;
            const state: LedgerState =
              r.deposits.length > 0 ? 'onItsWay'
              : r.dueDate < c.today ? 'late'
              : r.dueDate.getTime() < c.today.getTime() + DAY ? 'dueToday'
              : 'upcoming';
            return {
              id: r.id,
              group: f.group,
              type: r.type,
              date: r.dueDate.toISOString(),
              amount: D(r.amount).toString(),
              state,
              party: { kind: 'customer', id: ct.customer?.id ?? null, name: ct.customer?.fullName ?? null },
              contract: { id: ct.id, number: ct.contractNumber },
              unit: ct.unit,
              reservation: ct.reservation ? { id: ct.reservation.id, number: ct.reservation.reservationNumber } : null,
              ref: { kind: 'installment', id: r.id, code: null },
              payout: null,
            } satisfies LedgerRow;
          }),
          total,
        );
      }
      case 'bookings': {
        const and: Prisma.ReservationWhereInput[] = [this.bookingWhere(f, c)];
        if (f.state === 'onItsWay') and.push({ bookingPaymentStatus: ReservationBookingPaymentStatus.PENDING });
        else if (f.state) and.push({ bookingPaymentStatus: ReservationBookingPaymentStatus.UNPAID });
        const where = { AND: and };
        const [rows, total] = await Promise.all([
          this.prisma.reservation.findMany({
            where,
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            skip,
            take,
            select: {
              id: true,
              reservationNumber: true,
              createdAt: true,
              bookingAmount: true,
              bookingPaymentStatus: true,
              unit: { select: UNIT_SELECT },
              client: { select: { id: true, fullName: true } },
              lead: { select: { fullName: true } },
            },
          }),
          this.prisma.reservation.count({ where }),
        ]);
        return page(
          rows.map((r) => ({
            id: r.id,
            group: 'bookings',
            type: 'BOOKING',
            date: r.createdAt.toISOString(),
            amount: D(r.bookingAmount).toString(),
            state: r.bookingPaymentStatus === ReservationBookingPaymentStatus.PENDING ? 'onItsWay' : 'late',
            party: { kind: 'client', id: r.client?.id ?? null, name: r.client?.fullName ?? r.lead?.fullName ?? null },
            contract: null,
            unit: r.unit,
            reservation: { id: r.id, number: r.reservationNumber },
            ref: { kind: 'reservation', id: r.id, code: r.reservationNumber },
            payout: null,
          })),
          total,
        );
      }
      case 'commissions':
      case 'onHold': {
        const w = this.commissionWhere(f, c);
        const where: Prisma.BrokerCommissionWhereInput =
          f.group === 'onHold' ? w.onHold
          : f.state === 'late' ? w.late
          : f.state === 'pendingApproval' ? w.pendingApproval
          : { OR: [w.late, w.pendingApproval] };
        const [rows, total, bonusRows] = await Promise.all([
          this.prisma.brokerCommission.findMany({
            where,
            orderBy: [{ earnedAt: 'asc' }, { id: 'asc' }],
            skip: f.group === 'onHold' ? undefined : skip,
            take: f.group === 'onHold' ? undefined : take,
            select: {
              id: true,
              commissionNumber: true,
              status: true,
              earnedAt: true,
              approvedAt: true,
              netAmount: true,
              broker: { select: { id: true, companyName: true, commercialName: true } },
              contract: { select: CONTRACT_REF },
              payout: { select: { id: true, payoutNumber: true } },
            },
          }),
          this.prisma.brokerCommission.count({ where }),
          f.group === 'onHold'
            ? this.prisma.bonusEntry.findMany({
                where: this.bonusWhere(f, c).onHold,
                orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
                select: {
                  id: true,
                  createdAt: true,
                  amount: true,
                  sales: { select: { id: true, fullName: true } },
                  contract: { select: CONTRACT_REF },
                },
              })
            : Promise.resolve([]),
        ]);
        const mapped: LedgerRow[] = rows.map((r) => ({
          id: r.id,
          group: f.group,
          type: 'COMMISSION',
          date: (r.status === BrokerCommissionStatus.PENDING ? r.earnedAt : (r.approvedAt ?? r.earnedAt)).toISOString(),
          amount: D(r.netAmount).toString(),
          state: r.status === BrokerCommissionStatus.PENDING ? 'pendingApproval' : 'late',
          party: { kind: 'broker', id: r.broker.id, name: r.broker.commercialName ?? r.broker.companyName },
          contract: { id: r.contract.id, number: r.contract.contractNumber },
          unit: r.contract.unit,
          reservation: null,
          ref: { kind: 'commission', id: r.id, code: r.commissionNumber },
          payout: r.payout ? { id: r.payout.id, number: r.payout.payoutNumber } : null,
        }));
        if (f.group !== 'onHold') return page(mapped, total);
        const all = [
          ...mapped,
          ...bonusRows.map((b) => ({
            id: b.id,
            group: 'onHold' as const,
            type: 'BONUS',
            date: b.createdAt.toISOString(),
            amount: D(b.amount).toString(),
            state: 'pendingApproval' as const,
            party: { kind: 'sales' as const, id: b.sales.id, name: b.sales.fullName },
            contract: b.contract ? { id: b.contract.id, number: b.contract.contractNumber } : null,
            unit: b.contract?.unit ?? null,
            reservation: null,
            ref: b.contract ? { kind: 'contract' as const, id: b.contract.id, code: b.contract.contractNumber } : null,
            payout: null,
          })),
        ].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
        return inMemory(all);
      }
      case 'bonuses': {
        const w = this.bonusWhere(f, c);
        const where =
          f.state === 'late' ? w.late : f.state === 'pendingApproval' ? w.pendingApproval : { OR: [w.late, w.pendingApproval] };
        const [rows, total] = await Promise.all([
          this.prisma.bonusEntry.findMany({
            where,
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            skip,
            take,
            select: {
              id: true,
              status: true,
              createdAt: true,
              approvedAt: true,
              amount: true,
              sales: { select: { id: true, fullName: true } },
              contract: { select: CONTRACT_REF },
            },
          }),
          this.prisma.bonusEntry.count({ where }),
        ]);
        return page(
          rows.map((b) => ({
            id: b.id,
            group: 'bonuses',
            type: 'BONUS',
            date: (b.status === BonusEntryStatus.PENDING ? b.createdAt : (b.approvedAt ?? b.createdAt)).toISOString(),
            amount: D(b.amount).toString(),
            state: b.status === BonusEntryStatus.PENDING ? 'pendingApproval' : 'late',
            party: { kind: 'sales', id: b.sales.id, name: b.sales.fullName },
            contract: b.contract ? { id: b.contract.id, number: b.contract.contractNumber } : null,
            unit: b.contract?.unit ?? null,
            reservation: null,
            ref: b.contract ? { kind: 'contract', id: b.contract.id, code: b.contract.contractNumber } : null,
            payout: null,
          })),
          total,
        );
      }
      case 'topUps': {
        const where = this.topUpWhere(f, c);
        const [rows, total] = await Promise.all([
          this.prisma.brokerCommissionAdjustment.findMany({
            where,
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            skip,
            take,
            select: {
              id: true,
              createdAt: true,
              amount: true,
              broker: { select: { id: true, companyName: true, commercialName: true } },
              commission: { select: { id: true, commissionNumber: true, contract: { select: CONTRACT_REF } } },
              payout: { select: { id: true, payoutNumber: true } },
            },
          }),
          this.prisma.brokerCommissionAdjustment.count({ where }),
        ]);
        return page(
          rows.map((r) => ({
            id: r.id,
            group: 'topUps',
            type: 'TOP_UP',
            date: r.createdAt.toISOString(),
            amount: D(r.amount).toString(),
            state: 'late',
            party: { kind: 'broker', id: r.broker.id, name: r.broker.commercialName ?? r.broker.companyName },
            contract: { id: r.commission.contract.id, number: r.commission.contract.contractNumber },
            unit: r.commission.contract.unit,
            reservation: null,
            ref: { kind: 'commission', id: r.commission.id, code: r.commission.commissionNumber },
            payout: r.payout ? { id: r.payout.id, number: r.payout.payoutNumber } : null,
          })),
          total,
        );
      }
      case 'refunds':
        return inMemory(await this.refundRows(f, c));
      case 'clawbacks':
        return inMemory(await this.clawbackRows(f, c));
    }
  }
}

/** Which side a group is on. */
export function ledgerSide(group: LedgerGroup): 'receivables' | 'payables' {
  return (RECEIVABLE_GROUPS as readonly string[]).includes(group) ? 'receivables' : 'payables';
}

export { PlanPaymentType };
