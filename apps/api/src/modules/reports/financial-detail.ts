import { PaymentInstrumentStatus, Prisma } from '@prisma/client';
import { withDepositState, type DepositState, type DepositStateInput } from '../../common/finance/deposit-state';

/**
 * The lists behind the exported financial report (PDF / Excel): every payment
 * of the period, who is late and by how much, what falls due in the next 30
 * days, and the cheques. The screen does not read them. Pure: takes the rows
 * the service fetched with the report's own filters, so the totals here agree
 * with the report's figures (collected, late, …).
 */

// The wording of the dashboard (payment-state.tsx, cheques page).
export const DEPOSIT_STATE_AR: Record<DepositState, string> = {
  COLLECTED: 'تم التحصيل',
  PENDING_REVIEW: 'إيصال قيد المراجعة',
  CHEQUE_PENDING: 'شيك لم يُصرف بعد',
  REJECTED: 'إيصال مرفوض',
  BOUNCED: 'شيك مرتد',
  REVERSED: 'دفعة معكوسة',
  DELETED: 'محذوفة',
};
export const PAYMENT_METHOD_AR: Record<string, string> = {
  CASH: 'نقدًا',
  BANK_TRANSFER: 'تحويل بنكي',
  CHEQUE: 'شيك',
  OTHER: 'أخرى',
};
export const NO_METHOD_AR = 'غير محددة';
export const CHEQUE_STATUS_AR: Record<string, string> = {
  PENDING_CLEARANCE: 'لم يُودَع',
  DEPOSITED: 'مودَع بالبنك',
  CLEARED: 'تم الصرف',
  BOUNCED: 'مرتد',
  REPLACED: 'مستبدَل',
  CANCELLED: 'ملغى',
};
/** Cheques still to watch: not cleared yet, or bounced and not replaced. */
export const OPEN_CHEQUE_STATUSES = ['PENDING_CLEARANCE', 'DEPOSITED', 'BOUNCED'];
/** Payment (DepositType) and schedule-row (PlanPaymentType) kinds. */
export const PAYMENT_KIND_AR: Record<string, string> = {
  BOOKING_AMOUNT: 'مبلغ الحجز',
  RESERVATION: 'مبلغ الحجز',
  DOWN_PAYMENT: 'دفعة أولى',
  INSTALLMENT: 'قسط',
  FINAL_PAYMENT: 'دفعة أخيرة',
  FEE: 'رسوم وغرامات',
  BOUNCE_PENALTY: 'غرامة شيك مرتد',
  LATE_FEE: 'غرامة تأخير',
  TRANSFER_FEE: 'رسوم تنازل',
};

/** Rows fetched beyond this are left out (and the report says so). */
export const DETAIL_LIMIT = 5000;

const DAY = 86_400_000;

type Named = { fullName: string | null } | null | undefined;
type UnitRef = {
  code: string | null;
  building?: { phase?: { project?: { id: string; name: unknown } | null } | null } | null;
} | null;

export interface LedgerInput extends DepositStateInput {
  type: string;
  amount: Prisma.Decimal | number | string;
  paidAt: Date;
  paymentMethod: string | null;
  paymentInstrument?: { status: PaymentInstrumentStatus; type?: string | null } | null;
  contract?: { contractNumber: string | null; customer: Named; unit: UnitRef } | null;
  reservation?: {
    reservationNumber: string | null;
    client: Named;
    lead: Named;
    unit: UnitRef;
  } | null;
}

export interface InstallmentInput {
  type: string;
  dueDate: Date;
  amount: Prisma.Decimal | number | string;
  /** Payments on their way (proof under review / cheque not cleared). */
  deposits?: Array<unknown>;
  plan: {
    contract: {
      id: string;
      contractNumber: string | null;
      customer: { fullName: string | null; phone?: string | null } | null;
      unit: { code: string | null } | null;
    } | null;
  } | null;
}

export interface ChequeInput {
  chequeNumber: string | null;
  drawerBankName: string | null;
  chequeDueDate: Date | null;
  status: string;
  deposits: Array<{
    amount: Prisma.Decimal | number | string;
    contract?: { contractNumber: string | null; customer: Named; unit: { code: string | null } | null } | null;
    reservation?: {
      reservationNumber: string | null;
      client: Named;
      lead: Named;
      unit: { code: string | null } | null;
    } | null;
  }>;
}

const dec = (v: Prisma.Decimal | number | string | null | undefined) => new Prisma.Decimal(v ?? 0);

export interface FinancialDetail {
  ledger: Array<{
    paidAt: Date;
    customer: string;
    unit: string;
    reference: string;
    type: string;
    method: string;
    amount: number;
    state: DepositState;
    stateLabel: string;
  }>;
  ledgerTruncated: boolean;
  /** Sum of the ledger's collected rows (= the report's collected). */
  ledgerCollected: number;
  /** Sum of rows on their way (proof under review / cheque not cleared). */
  ledgerAwaiting: number;
  byProject: Array<{ name: string; count: number; collected: number; awaiting: number }>;
  byMethod: Array<{ name: string; count: number; collected: number; awaiting: number }>;
  latePayers: Array<{
    customer: string;
    phone: string;
    unit: string;
    contract: string;
    count: number;
    amount: number;
    oldestDue: Date;
    daysLate: number;
  }>;
  lateTruncated: boolean;
  next30: Array<{
    dueDate: Date;
    customer: string;
    phone: string;
    unit: string;
    contract: string;
    type: string;
    amount: number;
    onItsWay: boolean;
  }>;
  next30Truncated: boolean;
  cheques: Array<{
    number: string;
    bank: string;
    dueDate: Date | null;
    customer: string;
    unit: string;
    reference: string;
    amount: number;
    status: string;
    statusLabel: string;
  }>;
  chequesTruncated: boolean;
  chequesByStatus: Array<{ status: string; label: string; count: number; amount: number }>;
}

const PROJECT_NONE = 'بدون مشروع';

export function buildFinancialDetail(input: {
  deposits: LedgerInput[];
  late: InstallmentInput[];
  next30: InstallmentInput[];
  cheques: ChequeInput[];
  today: Date;
  projectName: (name: unknown) => string;
  limit?: number;
}): FinancialDetail {
  const limit = input.limit ?? DETAIL_LIMIT;

  // ── Collections ledger + by project + by method ──────────────────────────
  type Acc = { count: number; collected: Prisma.Decimal; awaiting: Prisma.Decimal };
  const byProject = new Map<string, Acc>();
  const byMethod = new Map<string, Acc>();
  const add = (m: Map<string, Acc>, key: string, state: DepositState, amount: Prisma.Decimal) => {
    const acc = m.get(key) ?? { count: 0, collected: dec(0), awaiting: dec(0) };
    acc.count += 1;
    if (state === 'COLLECTED') acc.collected = acc.collected.plus(amount);
    else if (state === 'PENDING_REVIEW' || state === 'CHEQUE_PENDING') acc.awaiting = acc.awaiting.plus(amount);
    m.set(key, acc);
  };
  let collected = dec(0);
  let awaiting = dec(0);
  const ledger = input.deposits.slice(0, limit).map((d) => {
    const { state } = withDepositState(d);
    const amount = dec(d.amount);
    const unit = d.contract?.unit ?? d.reservation?.unit ?? null;
    const project = unit?.building?.phase?.project ?? null;
    // A deposit recorded before the method field: the cheque / transfer it rode on says it.
    const methodCode = d.paymentMethod ?? d.paymentInstrument?.type ?? null;
    const method = methodCode ? (PAYMENT_METHOD_AR[methodCode] ?? methodCode) : NO_METHOD_AR;
    if (state === 'COLLECTED') collected = collected.plus(amount);
    else if (state === 'PENDING_REVIEW' || state === 'CHEQUE_PENDING') awaiting = awaiting.plus(amount);
    add(byProject, project ? input.projectName(project.name) : PROJECT_NONE, state, amount);
    add(byMethod, method, state, amount);
    return {
      paidAt: d.paidAt,
      customer:
        d.contract?.customer?.fullName ??
        d.reservation?.client?.fullName ??
        d.reservation?.lead?.fullName ??
        '—',
      unit: unit?.code ?? '—',
      reference: d.contract?.contractNumber ?? d.reservation?.reservationNumber ?? '—',
      type: PAYMENT_KIND_AR[d.type] ?? d.type,
      method,
      amount: amount.toNumber(),
      state,
      stateLabel: DEPOSIT_STATE_AR[state],
    };
  });
  const groups = (m: Map<string, Acc>) =>
    [...m.entries()]
      .map(([name, a]) => ({
        name,
        count: a.count,
        collected: a.collected.toNumber(),
        awaiting: a.awaiting.toNumber(),
      }))
      .sort((a, b) => b.collected + b.awaiting - (a.collected + a.awaiting));

  // ── Late payers: one line per contract ──────────────────────────────────
  type Late = FinancialDetail['latePayers'][number] & { sum: Prisma.Decimal };
  const late = new Map<string, Late>();
  for (const i of input.late.slice(0, limit)) {
    const c = i.plan?.contract;
    const key = c?.id ?? '—';
    const row =
      late.get(key) ??
      ({
        customer: c?.customer?.fullName ?? '—',
        phone: c?.customer?.phone ?? '',
        unit: c?.unit?.code ?? '—',
        contract: c?.contractNumber ?? '—',
        count: 0,
        amount: 0,
        sum: dec(0),
        oldestDue: i.dueDate,
        daysLate: 0,
      } as Late);
    row.count += 1;
    row.sum = row.sum.plus(dec(i.amount));
    if (i.dueDate < row.oldestDue) row.oldestDue = i.dueDate;
    late.set(key, row);
  }
  const latePayers = [...late.values()]
    .map(({ sum, ...r }) => ({
      ...r,
      amount: sum.toNumber(),
      daysLate: Math.max(0, Math.round((input.today.getTime() - r.oldestDue.getTime()) / DAY)),
    }))
    .sort((a, b) => b.amount - a.amount);

  // ── Due in the next 30 days ──────────────────────────────────────────────
  const next30 = input.next30.slice(0, limit).map((i) => ({
    dueDate: i.dueDate,
    customer: i.plan?.contract?.customer?.fullName ?? '—',
    phone: i.plan?.contract?.customer?.phone ?? '',
    unit: i.plan?.contract?.unit?.code ?? '—',
    contract: i.plan?.contract?.contractNumber ?? '—',
    type: PAYMENT_KIND_AR[i.type] ?? i.type,
    amount: dec(i.amount).toNumber(),
    onItsWay: (i.deposits?.length ?? 0) > 0,
  }));

  // ── Cheques ──────────────────────────────────────────────────────────────
  const statusAcc = new Map<string, { count: number; amount: Prisma.Decimal }>();
  const cheques = input.cheques.slice(0, limit).map((q) => {
    const amount = q.deposits.reduce((s, d) => s.plus(dec(d.amount)), dec(0));
    const first = q.deposits[0];
    const acc = statusAcc.get(q.status) ?? { count: 0, amount: dec(0) };
    acc.count += 1;
    acc.amount = acc.amount.plus(amount);
    statusAcc.set(q.status, acc);
    return {
      number: q.chequeNumber ?? '—',
      bank: q.drawerBankName ?? '—',
      dueDate: q.chequeDueDate,
      customer:
        first?.contract?.customer?.fullName ??
        first?.reservation?.client?.fullName ??
        first?.reservation?.lead?.fullName ??
        '—',
      unit: first?.contract?.unit?.code ?? first?.reservation?.unit?.code ?? '—',
      reference: first?.contract?.contractNumber ?? first?.reservation?.reservationNumber ?? '—',
      amount: amount.toNumber(),
      status: q.status,
      statusLabel: CHEQUE_STATUS_AR[q.status] ?? q.status,
    };
  });
  const chequesByStatus = Object.keys(CHEQUE_STATUS_AR)
    .filter((s) => statusAcc.has(s))
    .map((s) => ({
      status: s,
      label: CHEQUE_STATUS_AR[s]!,
      count: statusAcc.get(s)!.count,
      amount: statusAcc.get(s)!.amount.toNumber(),
    }));

  return {
    ledger,
    ledgerTruncated: input.deposits.length > limit,
    ledgerCollected: collected.toNumber(),
    ledgerAwaiting: awaiting.toNumber(),
    byProject: groups(byProject),
    byMethod: groups(byMethod),
    latePayers,
    lateTruncated: input.late.length > limit,
    next30,
    next30Truncated: input.next30.length > limit,
    cheques,
    chequesTruncated: input.cheques.length > limit,
    chequesByStatus,
  };
}
