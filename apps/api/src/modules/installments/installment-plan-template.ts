import {
  countText,
  dataTable,
  kpiGrid,
  moneyText,
  percentText,
  reportDocument,
  section,
} from '../../common/report-pdf/report-html';
import type { ReportBrand } from '../../common/utils/report-brand';

/**
 * A contract's installment schedule as a statement (كشف الأقساط): who and
 * what it is for, where the plan stands, and every row with what was paid,
 * what is left, how and when it was paid and the receipt — for the customer
 * or the file. `planStatement` builds the lines (PDF and Excel read the same
 * ones); `installmentPlanReportHtml` lays them out.
 */

export const PLAN_STATUS_AR: Record<string, string> = {
  PENDING: 'لم يُستحق بعد',
  OVERDUE: 'متأخر',
  PAID: 'مدفوع',
  CANCELLED: 'ملغى',
};

export const PLAN_TYPE_AR: Record<string, string> = {
  RESERVATION: 'حجز',
  DOWN_PAYMENT: 'دفعة أولى',
  INSTALLMENT: 'قسط',
  FINAL_PAYMENT: 'دفعة أخيرة',
  BOUNCE_PENALTY: 'غرامة شيك مرتد',
  LATE_FEE: 'غرامة تأخير',
  TRANSFER_FEE: 'رسوم تنازل',
};

const METHOD_AR: Record<string, string> = {
  CASH: 'نقدًا',
  BANK_TRANSFER: 'تحويل بنكي',
  CHEQUE: 'شيك',
  OTHER: 'أخرى',
};

const FEE_TYPES = ['LATE_FEE', 'BOUNCE_PENALTY', 'TRANSFER_FEE'];
/** A date inside Arabic text: isolated left-to-right, or it reads 04-12-2026. */
const ltr = (v: string) => `\u2066${v}\u2069`;
const DAY = 86_400_000;

/** A payment on a row, already given its state (deposit-state.ts). */
export interface PlanRowPayment {
  id: string;
  state: string;
  paidAt: Date;
  method: string | null;
}

export interface PlanStatementInput {
  contractNumber: string;
  customer: string;
  phone: string | null;
  unit: string;
  project: string | null;
  signedAt: Date | null;
  /** The contract's value (net price, with the instalment markup). */
  contractValue: number | null;
  /** The company's today as a calendar day (yyyy-mm-dd). */
  today: string;
  /** Formats a timestamp as the company's calendar day. */
  localDay: (d: Date) => string;
  installments: Array<{
    id: string;
    type: string;
    dueDate: Date;
    amount: number;
    status: string;
    paidAt: Date | null;
    feeForId: string | null;
    payments: PlanRowPayment[];
  }>;
}

export interface PlanStatementRow {
  n: number;
  dueDate: string;
  type: string;
  amount: number;
  paid: number;
  remaining: number;
  status: string;
  paidAt: string;
  method: string;
  receipt: string;
  note: string;
  cancelled: boolean;
  fee: boolean;
}

/** The printed receipt's number (as on the receipt page). */
export const receiptNumber = (depositId: string) => depositId.slice(-8).toUpperCase();

export function planStatement(d: PlanStatementInput) {
  const day = (x: Date) => x.toISOString().slice(0, 10);
  const dueById = new Map(d.installments.map((i) => [i.id, day(i.dueDate)]));
  const rows: PlanStatementRow[] = d.installments.map((i, idx) => {
    const cancelled = i.status === 'CANCELLED';
    const paidRow = i.status === 'PAID';
    const collected = i.payments.find((p) => p.state === 'COLLECTED');
    const waiting = i.payments.find((p) => p.state === 'PENDING_REVIEW' || p.state === 'CHEQUE_PENDING');
    const due = day(i.dueDate);
    // A row is paid in full or not at all (no partial payments).
    const paid = paidRow ? i.amount : 0;
    const remaining = paidRow || cancelled ? 0 : i.amount;
    const late = !paidRow && !cancelled && !waiting && due < d.today;
    const daysLate = late ? Math.round((Date.parse(d.today) - Date.parse(due)) / DAY) : 0;
    const dueToday = !paidRow && !cancelled && !waiting && due === d.today;
    const status = waiting
      ? 'بانتظار التأكيد'
      : late
        ? 'متأخر'
        : dueToday
          ? 'مستحق اليوم'
          : (PLAN_STATUS_AR[i.status] ?? i.status);
    const shown = collected ?? waiting;
    const notes = [
      i.feeForId && dueById.get(i.feeForId) ? `عن قسط ${ltr(dueById.get(i.feeForId)!)}` : '',
      late ? `متأخر ${countText(daysLate)} يوم` : '',
      waiting ? (waiting.state === 'CHEQUE_PENDING' ? 'شيك لم يُصرف بعد' : 'إيصال قيد المراجعة') : '',
      paidRow && !collected ? 'مسجّل بدون إيصال' : '',
    ].filter(Boolean);
    return {
      n: idx + 1,
      dueDate: due,
      type: PLAN_TYPE_AR[i.type] ?? i.type,
      amount: i.amount,
      paid,
      remaining,
      status,
      paidAt: paidRow ? (collected ? d.localDay(collected.paidAt) : i.paidAt ? d.localDay(i.paidAt) : '') : '',
      method: shown?.method ? (METHOD_AR[shown.method] ?? shown.method) : '',
      receipt: shown ? receiptNumber(shown.id) : '',
      note: notes.join(' · '),
      cancelled,
      fee: FEE_TYPES.includes(i.type),
    };
  });

  const live = rows.filter((r) => !r.cancelled);
  const sum = (rs: PlanStatementRow[], f: (r: PlanStatementRow) => number) => rs.reduce((a, r) => a + f(r), 0);
  const total = sum(live, (r) => r.amount);
  const paid = sum(live, (r) => r.paid);
  const remaining = sum(live, (r) => r.remaining);
  const overdueRows = live.filter((r) => r.status === 'متأخر');
  const overdue = sum(overdueRows, (r) => r.remaining);
  const awaiting = sum(live.filter((r) => r.status === 'بانتظار التأكيد'), (r) => r.remaining);
  const fees = sum(live.filter((r) => r.fee), (r) => r.amount);
  const next = live.find((r) => r.remaining > 0 && r.status !== 'بانتظار التأكيد' && r.dueDate >= d.today);
  const lastPaid = [...live].filter((r) => r.paidAt).sort((a, b) => (a.paidAt < b.paidAt ? 1 : -1))[0];
  return {
    header: {
      contractNumber: d.contractNumber,
      customer: d.customer,
      phone: d.phone,
      unit: d.unit,
      project: d.project,
      signedAt: d.signedAt ? d.localDay(d.signedAt) : null,
      contractValue: d.contractValue,
    },
    rows,
    totals: {
      total,
      paid,
      remaining,
      overdue,
      overdueCount: overdueRows.length,
      awaiting,
      fees,
      rowCount: live.length,
      paidCount: live.filter((r) => r.paid > 0).length,
    },
    next: next ? { dueDate: next.dueDate, amount: next.amount, type: next.type } : null,
    lastPaid: lastPaid ? { paidAt: lastPaid.paidAt, amount: lastPaid.paid, type: lastPaid.type } : null,
  };
}

export type PlanStatement = ReturnType<typeof planStatement>;

export function installmentPlanReportHtml(s: PlanStatement, brand: ReportBrand): string {
  const c = brand.currency;
  const t = s.totals;
  const h = s.header;
  return reportDocument({
    brand,
    title: 'كشف الأقساط',
    subtitle: h.project ? `عقد ${h.contractNumber} · ${h.project}` : `عقد ${h.contractNumber}`,
    // Eleven columns: the page is sideways.
    landscape: true,
    meta: [
      ['العميل', h.customer],
      ...(h.phone ? ([['الهاتف', h.phone]] as Array<[string, string]>) : []),
      ['الوحدة', h.unit],
      ...(h.signedAt ? ([['تاريخ التوقيع', h.signedAt]] as Array<[string, string]>) : []),
    ],
    body: [
      section(
        'الملخص',
        kpiGrid(
          [
            ...(h.contractValue != null ? [{ label: 'قيمة العقد', value: moneyText(h.contractValue, c) }] : []),
            {
              label: 'إجمالي الخطة',
              value: moneyText(t.total, c),
              hint: `${countText(t.rowCount)} دفعة${t.fees > 0 ? ` · منها رسوم وغرامات ${moneyText(t.fees, c)}` : ''}`,
            },
            {
              label: 'المدفوع',
              value: moneyText(t.paid, c),
              hint: `${countText(t.paidCount)} دفعة · ${percentText(t.paid, t.total)} من الخطة`,
              tone: 'good' as const,
            },
            { label: 'المتبقي', value: moneyText(t.remaining, c) },
            {
              label: 'المتأخر',
              value: moneyText(t.overdue, c),
              hint: t.overdueCount ? `${countText(t.overdueCount)} دفعة` : undefined,
              tone: t.overdue ? ('warn' as const) : ('default' as const),
            },
            ...(t.awaiting > 0 ? [{ label: 'بانتظار التأكيد (إيصال/شيك)', value: moneyText(t.awaiting, c) }] : []),
            ...(s.next
              ? [{ label: 'الدفعة القادمة', value: moneyText(s.next.amount, c), hint: `${s.next.type} · تستحق ${ltr(s.next.dueDate)}` }]
              : []),
            ...(s.lastPaid
              ? [{ label: 'آخر دفعة', value: moneyText(s.lastPaid.amount, c), hint: `${s.lastPaid.type} · دُفعت ${ltr(s.lastPaid.paidAt)}` }]
              : []),
          ],
          4,
        ),
      ),
      section(
        'جدول الأقساط',
        dataTable(
          [
            { label: '#', numeric: true, width: 0.35 },
            { label: 'الاستحقاق', numeric: true, width: 0.95 },
            { label: 'البند', width: 0.95 },
            { label: 'المبلغ', numeric: true, width: 1.15 },
            { label: 'المدفوع', numeric: true, width: 1.15 },
            { label: 'المتبقي', numeric: true, width: 1.15 },
            { label: 'الحالة', width: 0.95 },
            { label: 'تاريخ الدفع', numeric: true, width: 0.95 },
            { label: 'طريقة الدفع', width: 0.85 },
            { label: 'رقم الإيصال', numeric: true, width: 0.9 },
            { label: 'ملاحظة', width: 1.5 },
          ],
          s.rows.map((r) => [
            r.n,
            r.dueDate,
            r.type,
            moneyText(r.amount, c),
            r.paid ? moneyText(r.paid, c) : '—',
            r.remaining ? moneyText(r.remaining, c) : '—',
            r.status,
            r.paidAt || '—',
            r.method || '—',
            r.receipt || '—',
            r.note,
          ]),
          {
            totals: [
              '',
              '',
              'الإجمالي',
              moneyText(t.total, c),
              moneyText(t.paid, c),
              moneyText(t.remaining, c),
              '',
              '',
              '',
              '',
              'عدا الملغى',
            ],
            empty: 'لا توجد أقساط',
          },
        ),
      ),
    ].join('\n'),
  });
}
