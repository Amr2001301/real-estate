import {
  InstallmentStatus,
  PlanPaymentType,
  Prisma,
  ReservationBookingPaymentStatus,
} from '@prisma/client';
import { DepositState } from '../../common/finance/deposit-state';

/**
 * Statement of account (كشف حساب) for one contract: what the customer owes
 * and what they paid, line by line, with the balance after each line.
 *
 *   - opens with the contract value (debit);
 *   - fees and penalties charged on the schedule are debits on their due day
 *     (a waived fee is CANCELLED and does not appear);
 *   - every collected payment is a credit on the day it was paid;
 *   - a reversed or bounced payment shows its credit and the reversal that
 *     undid it (a debit), with the reason and who reversed it;
 *   - a row marked paid with no payment recorded (a pre-system contract, a
 *     booking confirmed on the reservation) is a credit too, so the closing
 *     balance is what is left on the contract.
 *
 * Proofs under review and uncleared cheques are not in the balance — they are
 * listed apart as "awaiting".
 */
export type StatementLineKind = 'CONTRACT' | 'FEE' | 'PAYMENT' | 'REVERSAL' | 'WAIVER';

export interface StatementLine {
  date: string;
  kind: StatementLineKind;
  /** Schedule row type (or BOOKING) the line belongs to. */
  rowType: string | null;
  /** Due day of the schedule row the line belongs to. */
  rowDueDate?: string | null;
  depositId: string | null;
  method: string | null;
  /** Payment recorded with no deposit behind it (pre-system / confirmed on the booking). */
  unrecorded?: boolean;
  debit: string;
  credit: string;
  balance: string;
  reason?: string | null;
  by?: string | null;
}

export interface StatementInput {
  totalAmount: Prisma.Decimal | number | string;
  signedAt: Date | null;
  createdAt: Date;
  preSystem: boolean;
  reservation: {
    bookingAmount: Prisma.Decimal | number | string;
    bookingPaymentStatus: ReservationBookingPaymentStatus;
    bookingPaidAt: Date | null;
    createdAt: Date;
  } | null;
  installments: Array<{
    id: string;
    type: PlanPaymentType;
    amount: Prisma.Decimal | number | string;
    dueDate: Date;
    status: InstallmentStatus;
    paidAt: Date | null;
    waivedAt: Date | null;
  }>;
  deposits: Array<{
    id: string;
    type: string;
    installmentId: string | null;
    amount: Prisma.Decimal | number | string;
    paidAt: Date;
    paymentMethod: string | null;
    paymentInstrument?: { type: string } | null;
    state: DepositState;
    reversedAt: Date | null;
    reversalReason: string | null;
    reversedBy: string | null;
  }>;
}

const FEE_TYPES: PlanPaymentType[] = [
  PlanPaymentType.LATE_FEE,
  PlanPaymentType.TRANSFER_FEE,
  PlanPaymentType.BOUNCE_PENALTY,
];
const OPEN: InstallmentStatus[] = [InstallmentStatus.PENDING, InstallmentStatus.OVERDUE];

const cents = (v: Prisma.Decimal | number | string) => Math.round(Number(v) * 100);
const money = (c: number) => (c / 100).toFixed(2);
const day = (d: Date) => d.toISOString().slice(0, 10);

export function buildStatement(c: StatementInput, today: string) {
  type Raw = Omit<StatementLine, 'debit' | 'credit' | 'balance'> & {
    debit: number;
    credit: number;
    order: number;
  };
  const raw: Raw[] = [];
  const add = (l: Omit<Raw, 'order'>) => raw.push({ ...l, order: raw.length });

  add({
    date: day(c.signedAt ?? c.createdAt),
    kind: 'CONTRACT',
    rowType: null,
    depositId: null,
    method: null,
    debit: cents(c.totalAmount),
    credit: 0,
  });

  for (const i of c.installments) {
    if (i.status === InstallmentStatus.CANCELLED || !FEE_TYPES.includes(i.type)) continue;
    add({
      date: day(i.dueDate),
      kind: 'FEE',
      rowType: i.type,
      rowDueDate: day(i.dueDate),
      depositId: null,
      method: null,
      debit: cents(i.amount),
      credit: 0,
    });
  }

  const rowType = new Map(c.installments.map((i) => [i.id, i.type as string]));
  const rowDue = new Map(c.installments.map((i) => [i.id, day(i.dueDate)]));
  const method = (d: StatementInput['deposits'][number]) =>
    d.paymentInstrument?.type ?? d.paymentMethod ?? null;
  const paidRows = new Set<string>();
  let bookingPaid = false;
  let awaiting = 0;
  const awaitingList: Array<{
    depositId: string;
    date: string;
    amount: string;
    state: DepositState;
    rowType: string | null;
  }> = [];

  for (const d of c.deposits) {
    const type = d.installmentId
      ? (rowType.get(d.installmentId) ?? null)
      : d.type === 'BOOKING_AMOUNT'
        ? 'BOOKING'
        : d.type;
    const rowDueDate = d.installmentId ? (rowDue.get(d.installmentId) ?? null) : null;
    if (d.state === 'PENDING_REVIEW' || d.state === 'CHEQUE_PENDING') {
      awaiting += cents(d.amount);
      awaitingList.push({
        depositId: d.id,
        date: day(d.paidAt),
        amount: money(cents(d.amount)),
        state: d.state,
        rowType: type,
      });
      continue;
    }
    if (d.state === 'COLLECTED') {
      if (d.installmentId) paidRows.add(d.installmentId);
      if (d.type === 'BOOKING_AMOUNT') bookingPaid = true;
      add({
        date: day(d.paidAt),
        kind: 'PAYMENT',
        rowType: type,
        rowDueDate,
        depositId: d.id,
        method: method(d),
        debit: 0,
        credit: cents(d.amount),
      });
      continue;
    }
    // Counted once, then undone: show both, so the history reads right.
    if (d.state === 'REVERSED' && d.reversedAt) {
      add({
        date: day(d.paidAt),
        kind: 'PAYMENT',
        rowType: type,
        rowDueDate,
        depositId: d.id,
        method: method(d),
        debit: 0,
        credit: cents(d.amount),
      });
      add({
        date: day(d.reversedAt),
        kind: 'REVERSAL',
        rowType: type,
        rowDueDate,
        depositId: d.id,
        method: method(d),
        debit: cents(d.amount),
        credit: 0,
        reason: d.reversalReason,
        by: d.reversedBy,
      });
    }
  }

  // Paid with nothing recorded behind it.
  for (const i of c.installments) {
    if (i.status !== InstallmentStatus.PAID || paidRows.has(i.id)) continue;
    add({
      date: day(i.paidAt ?? i.dueDate),
      kind: 'PAYMENT',
      rowType: i.type,
      rowDueDate: day(i.dueDate),
      depositId: null,
      method: null,
      unrecorded: true,
      debit: 0,
      credit: cents(i.amount),
    });
  }
  const r = c.reservation;
  const booking = r ? cents(r.bookingAmount) : 0;
  if (r && booking > 0 && !bookingPaid) {
    if (r.bookingPaymentStatus === ReservationBookingPaymentStatus.PAID) {
      add({
        date: day(r.bookingPaidAt ?? r.createdAt),
        kind: 'PAYMENT',
        rowType: 'BOOKING',
        depositId: null,
        method: null,
        unrecorded: true,
        debit: 0,
        credit: booking,
      });
    } else if (r.bookingPaymentStatus === ReservationBookingPaymentStatus.WAIVED) {
      add({
        date: day(r.createdAt),
        kind: 'WAIVER',
        rowType: 'BOOKING',
        depositId: null,
        method: null,
        debit: 0,
        credit: booking,
      });
    }
  }

  raw.sort((a, b) => (a.date === b.date ? a.order - b.order : a.date < b.date ? -1 : 1));
  let balance = 0;
  let paid = 0;
  let fees = 0;
  const lines: StatementLine[] = raw.map(({ order: _order, debit, credit, ...l }) => {
    balance += debit - credit;
    if (l.kind === 'PAYMENT') paid += credit;
    if (l.kind === 'REVERSAL') paid -= debit;
    if (l.kind === 'FEE') fees += debit;
    return { ...l, debit: money(debit), credit: money(credit), balance: money(balance) };
  });

  // Where the open rows stand against today (company time zone).
  let overdue = 0;
  let dueToday = 0;
  let upcoming = 0;
  let openFees = 0;
  for (const i of c.installments) {
    if (!OPEN.includes(i.status)) continue;
    if (FEE_TYPES.includes(i.type)) openFees += cents(i.amount);
    const due = day(i.dueDate);
    if (due < today) overdue += cents(i.amount);
    else if (due === today) dueToday += cents(i.amount);
    else upcoming += cents(i.amount);
  }
  // An unpaid booking was due when the unit was booked (a booking with a
  // proof or cheque waiting is PENDING, and shows under "awaiting").
  if (
    r &&
    booking > 0 &&
    !bookingPaid &&
    r.bookingPaymentStatus === ReservationBookingPaymentStatus.UNPAID
  ) {
    overdue += booking;
  }

  return {
    asOf: today,
    lines,
    totals: {
      contractValue: money(cents(c.totalAmount)),
      fees: money(fees),
      paid: money(paid),
      balance: money(balance),
      overdue: money(overdue),
      dueToday: money(dueToday),
      upcoming: money(upcoming),
      awaiting: money(awaiting),
      /** Fees and penalties still open (in the balance). */
      openFees: money(openFees),
      /**
       * Owed with no open schedule row behind it — a contract with no plan
       * yet, or a down payment outside the schedule never recorded as paid.
       */
      unscheduled: money(Math.max(0, balance - overdue - dueToday - upcoming)),
    },
    awaiting: awaitingList,
  };
}

export type ContractStatement = ReturnType<typeof buildStatement>;
