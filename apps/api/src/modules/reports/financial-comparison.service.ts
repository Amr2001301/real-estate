/**
 * The financial report's comparison view: the chosen period against another
 * (the previous period, the previous month, the same period last year — the
 * caller decides the dates), as the figures an owner reads side by side.
 *
 * Every figure here belongs to a period (money collected, payments, fees,
 * contracts signed, bookings made, and what fell due in the period and how
 * much of it is settled). Figures that are "as of today" — contract value,
 * what is due to date, what is late — are not compared (a period's
 * "as of today" figure always reads the same) and stay in the main report.
 *
 * "Collected" is the report's own definition: money collected towards the
 * price of signed live contracts (COLLECTED + TOWARDS_PRICE); fees and
 * penalties are counted apart.
 */
import { Injectable } from '@nestjs/common';
import { DepositType, InstallmentStatus, Prisma, ReservationStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getRequiredCompanyId } from '../../common/tenant/tenant-context';
import { scopedUserFindMany } from '../../common/tenant/resolve-tenant-entity';
import { currentCompanyTimeZone } from '../../common/time/company-timezone';
import { localDate, reportRange } from '../../common/time/report-range';
import { COLLECTED_DEPOSIT_WHERE, FEES_DEPOSIT_WHERE, TOWARDS_PRICE_DEPOSIT_WHERE } from '../../common/finance/collected';
import { LIVE_CONTRACT_WHERE, LIVE_PLAN_WHERE, SURCHARGE_PAYMENT_TYPES } from '../installments/live-contract';

export interface FinancialComparisonOpts {
  dateFrom: string;
  dateTo: string;
  prevFrom: string;
  prevTo: string;
  projectId?: string;
  salesId?: string;
  type?: DepositType;
  q?: string;
}

export interface Period {
  from: string;
  to: string;
}

const DAY = 86_400_000;
const MAX_DAYS = 400;

function daysBetween(from: string, to: string): number {
  return Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / DAY);
}
const r2 = (n: number) => Math.round(n * 100) / 100;

const PROJECT_PATH = {
  unit: { select: { building: { select: { phase: { select: { project: { select: { id: true, name: true } } } } } } } },
} as const;

@Injectable()
export class FinancialComparisonService {
  constructor(private readonly prisma: PrismaService) {}

  async compare(opts: FinancialComparisonOpts) {
    const companyId = getRequiredCompanyId();
    const tz = await currentCompanyTimeZone(this.prisma, companyId);
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
    const dayOf = (d: Date) => fmt.format(d);
    const t = localDate(tz);
    const today = `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`;

    const cur: Period = { from: opts.dateFrom, to: opts.dateTo };
    const prev: Period = { from: opts.prevFrom, to: opts.prevTo };
    const curDays = Math.min(MAX_DAYS, daysBetween(cur.from, cur.to) + 1);
    const prevDays = Math.min(MAX_DAYS, daysBetween(prev.from, prev.to) + 1);

    // Twelve months ending with the month of the period's end, for the trends.
    const endMonth = cur.to.slice(0, 7);
    const months: string[] = [];
    {
      let y = Number(endMonth.slice(0, 4));
      let m = Number(endMonth.slice(5, 7));
      for (let i = 0; i < 12; i++) {
        months.unshift(`${y}-${String(m).padStart(2, '0')}`);
        m -= 1;
        if (m === 0) { m = 12; y -= 1; }
      }
    }
    const seriesFrom = `${months[0]}-01`;
    const earliest = [seriesFrom, prev.from, cur.from].sort()[0]!;
    const latest = [cur.to, prev.to].sort().reverse()[0]!;
    const span = reportRange(earliest, latest, tz);

    // ── Filters (project, salesperson, search) ───────────────────────────
    const projectOf = (id: string) => ({ unit: { building: { phase: { projectId: id } } } });
    const nameLike = (q: string) => ({ contains: q, mode: Prisma.QueryMode.insensitive });
    const depAnd: Prisma.DepositWhereInput[] = [{ companyId }];
    const contractAnd: Prisma.ContractWhereInput[] = [LIVE_CONTRACT_WHERE, { companyId }];
    const reservationAnd: Prisma.ReservationWhereInput[] = [{ deletedAt: null, companyId }];
    if (opts.projectId) {
      depAnd.push({ OR: [{ contract: projectOf(opts.projectId) }, { reservation: projectOf(opts.projectId) }] });
      contractAnd.push(projectOf(opts.projectId));
      reservationAnd.push(projectOf(opts.projectId));
    }
    if (opts.salesId) {
      depAnd.push({ OR: [{ contract: { reservation: { salesId: opts.salesId } } }, { reservation: { salesId: opts.salesId } }] });
      contractAnd.push({ reservation: { salesId: opts.salesId } });
      reservationAnd.push({ salesId: opts.salesId });
    }
    if (opts.q) {
      depAnd.push({
        OR: [
          { contract: { customer: { fullName: nameLike(opts.q) } } },
          { reservation: { client: { fullName: nameLike(opts.q) } } },
          { reservation: { lead: { fullName: nameLike(opts.q) } } },
        ],
      });
      contractAnd.push({ customer: { fullName: nameLike(opts.q) } });
      reservationAnd.push({ OR: [{ client: { fullName: nameLike(opts.q) } }, { lead: { fullName: nameLike(opts.q) } }] });
    }
    if (opts.type) depAnd.push({ type: opts.type });

    // ── Deposits: towards the price, and fees ────────────────────────────
    const depSelect = {
      amount: true,
      paidAt: true,
      type: true,
      contract: { select: { ...PROJECT_PATH, reservation: { select: { salesId: true } } } },
      reservation: { select: { ...PROJECT_PATH, salesId: true } },
    } satisfies Prisma.DepositSelect;
    const [towards, fees, contracts, reservations, dueRows] = await Promise.all([
      this.prisma.deposit.findMany({
        where: { AND: [COLLECTED_DEPOSIT_WHERE, TOWARDS_PRICE_DEPOSIT_WHERE, { paidAt: span }, ...depAnd] },
        select: depSelect,
      }),
      this.prisma.deposit.findMany({
        where: { AND: [COLLECTED_DEPOSIT_WHERE, FEES_DEPOSIT_WHERE, { paidAt: span }, ...depAnd] },
        select: { amount: true, paidAt: true },
      }),
      this.prisma.contract.findMany({
        where: { AND: [...contractAnd, { signedAt: span }] },
        select: { signedAt: true },
      }),
      this.prisma.reservation.findMany({
        where: { AND: [...reservationAnd, { createdAt: span }, { status: { notIn: [ReservationStatus.REJECTED, ReservationStatus.CANCELLED, ReservationStatus.EXPIRED] } }] },
        select: { createdAt: true },
      }),
      // What fell due in either period (calendar days), and whether it is settled by now.
      this.prisma.installment.findMany({
        where: {
          AND: [
            { plan: { ...LIVE_PLAN_WHERE, contract: { ...LIVE_CONTRACT_WHERE, signedAt: { not: null }, ...(opts.projectId ? projectOf(opts.projectId) : {}), ...(opts.salesId ? { reservation: { salesId: opts.salesId } } : {}), ...(opts.q ? { customer: { fullName: nameLike(opts.q) } } : {}) } } },
            { type: { notIn: SURCHARGE_PAYMENT_TYPES }, status: { not: InstallmentStatus.CANCELLED } },
            { OR: [
              { dueDate: { gte: new Date(`${cur.from}T00:00:00Z`), lte: new Date(`${cur.to}T00:00:00Z`) } },
              { dueDate: { gte: new Date(`${prev.from}T00:00:00Z`), lte: new Date(`${prev.to}T00:00:00Z`) } },
            ] },
          ],
        },
        select: { amount: true, status: true, dueDate: true },
      }),
    ]);

    const inP = (day: string, p: Period) => day >= p.from && day <= p.to;
    const sum = (rows: { amount: Prisma.Decimal }[]) => rows.reduce((n, r) => n + Number(r.amount), 0);

    const towardsDay = towards.map((d) => ({ ...d, day: dayOf(d.paidAt) }));
    const feeDay = fees.map((d) => ({ amount: d.amount, day: dayOf(d.paidAt) }));
    const inPeriod = <T extends { day: string }>(rows: T[], p: Period) => rows.filter((r) => inP(r.day, p));

    const figures = (p: Period) => {
      const rows = inPeriod(towardsDay, p);
      const collected = sum(rows);
      const payments = rows.length;
      return {
        collected: r2(collected),
        payments,
        avgPayment: payments ? r2(collected / payments) : 0,
        fees: r2(sum(inPeriod(feeDay, p))),
        contractsSigned: contracts.filter((c) => inP(dayOf(c.signedAt!), p)).length,
        reservations: reservations.filter((r) => inP(dayOf(r.createdAt), p)).length,
      };
    };

    const dueFigures = (p: Period) => {
      const rows = dueRows.filter((r) => inP(r.dueDate.toISOString().slice(0, 10), p));
      const due = sum(rows);
      const settled = sum(rows.filter((r) => r.status === InstallmentStatus.PAID));
      return { due: r2(due), settled: r2(settled), open: r2(due - settled), rate: due > 0 ? Math.round((settled / due) * 100) : null };
    };

    // ── Month by month, for the trend lines ───────────────────────────────
    const byMonth = (rows: { day: string; amount?: Prisma.Decimal }[], weight: 'amount' | 'count') =>
      months.map((m) => {
        const inM = rows.filter((r) => r.day.startsWith(m));
        return r2(weight === 'count' ? inM.length : inM.reduce((n, r) => n + Number(r.amount), 0));
      });
    const trend = {
      months,
      collected: byMonth(towardsDay, 'amount'),
      payments: byMonth(towardsDay, 'count'),
      fees: byMonth(feeDay, 'amount'),
      contractsSigned: byMonth(contracts.map((c) => ({ day: dayOf(c.signedAt!) })), 'count'),
      reservations: byMonth(reservations.map((r) => ({ day: dayOf(r.createdAt) })), 'count'),
    };
    const avgTrend = trend.collected.map((c, i) => (trend.payments[i]! > 0 ? r2(c / trend.payments[i]!) : 0));

    // ── Splits: project, payment type, salesperson ────────────────────────
    const projectName = new Map<string, unknown>();
    const group = (key: (d: (typeof towardsDay)[number]) => string | null) => {
      const m = new Map<string, { cur: number; prev: number }>();
      for (const d of towardsDay) {
        const inCur = inP(d.day, cur);
        const inPrev = inP(d.day, prev);
        if (!inCur && !inPrev) continue;
        const k = key(d);
        if (!k) continue;
        const e = m.get(k) ?? { cur: 0, prev: 0 };
        if (inCur) e.cur += Number(d.amount);
        if (inPrev) e.prev += Number(d.amount);
        m.set(k, e);
      }
      return m;
    };
    const unitOf = (d: (typeof towardsDay)[number]) => d.contract ?? d.reservation;
    const projectKey = (d: (typeof towardsDay)[number]) => {
      const p = unitOf(d)?.unit?.building?.phase?.project;
      if (!p) return null;
      projectName.set(p.id, p.name);
      return p.id;
    };
    const byProject = group(projectKey);
    const byType = group((d) => d.type);
    const bySales = group((d) => d.contract?.reservation?.salesId ?? d.reservation?.salesId ?? null);
    const users = bySales.size
      ? await scopedUserFindMany(this.prisma, { id: { in: [...bySales.keys()] } }, { id: true, fullName: true })
      : [];
    const userName = new Map(users.map((u) => [u.id, u.fullName]));
    const list = (m: Map<string, { cur: number; prev: number }>, label: (k: string) => unknown) =>
      [...m.entries()]
        .map(([k, v]) => ({ key: k, name: label(k), cur: r2(v.cur), prev: r2(v.prev) }))
        .sort((a, b) => Math.max(b.cur, b.prev) - Math.max(a.cur, a.prev));

    // ── Cumulative, day by day ────────────────────────────────────────────
    const cumulative = (p: Period, days: number, until: number) => {
      const perDay = new Array<number>(days).fill(0);
      for (const d of inPeriod(towardsDay, p)) {
        const i = daysBetween(p.from, d.day);
        if (i >= 0 && i < days) perDay[i]! += Number(d.amount);
      }
      let c = 0;
      return perDay.slice(0, until).map((v) => (c += v, r2(c)));
    };
    // The current period runs to today at most (the days after have not happened).
    const elapsed = Math.max(1, Math.min(curDays, daysBetween(cur.from, today) + 1));

    return {
      period: cur,
      previous: prev,
      today,
      days: { current: curDays, previous: prevDays, elapsed },
      figures: { current: figures(cur), previous: figures(prev) },
      // A payment type does not split what falls due, so the dues are left out under that filter.
      due: opts.type ? null : { current: dueFigures(cur), previous: dueFigures(prev) },
      trend: { ...trend, avgPayment: avgTrend },
      byProject: list(byProject, (k) => projectName.get(k)),
      byType: list(byType, (k) => k),
      bySales: list(bySales, (k) => userName.get(k) ?? '—'),
      cumulative: {
        current: cumulative(cur, curDays, elapsed),
        previous: cumulative(prev, prevDays, prevDays),
      },
    };
  }
}
