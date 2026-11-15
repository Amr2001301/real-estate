import { Prisma } from '@prisma/client';
import { commissionBasis } from '../../common/finance/commission-basis';

/**
 * The lists behind the exported sales report (PDF / Excel): every contract
 * signed in the period, sales by rep and by unit type, and the reservations
 * still open. Pure: takes the rows the service fetched with the report's own
 * filter (signed, live contracts, by signing date), so the contracts' total
 * agrees with the report's figure. A sale is the net price — the contract
 * total without the instalment markup (decided 2026-10-17).
 */

export const RESERVATION_STATUS_AR: Record<string, string> = {
  PENDING: 'بانتظار الاعتماد',
  APPROVED: 'معتمد',
};
export const BOOKING_PAYMENT_AR: Record<string, string> = {
  UNPAID: 'لم يُدفع',
  PENDING: 'بانتظار التأكيد',
  PAID: 'مدفوع',
  WAIVED: 'معفى',
};

const NO_REP = 'بدون مندوب';
const NO_TYPE = 'غير محدد';

type Name = { fullName: string | null } | null | undefined;
type Translatable = unknown;

export interface SalesContractInput {
  contractNumber: string | null;
  signedAt: Date | null;
  totalAmount: Prisma.Decimal | number | string;
  markupWaived: Prisma.Decimal | number | string;
  customer: Name;
  unit: {
    code: string | null;
    type: string | null;
    area: number | null;
    building?: { phase?: { project?: { name: Translatable } | null } | null } | null;
  } | null;
  reservation: {
    snapshotFinancedAmount: Prisma.Decimal | null;
    snapshotRemainingAmount: Prisma.Decimal | null;
    sales: Name;
  } | null;
  broker: { companyName: Translatable } | null;
}

export interface OpenReservationInput {
  reservationNumber: string | null;
  createdAt: Date;
  expiresAt: Date;
  status: string;
  bookingAmount: Prisma.Decimal | number | string;
  bookingPaymentStatus: string;
  client: Name;
  lead: Name;
  sales: Name;
  unit: {
    code: string | null;
    price?: Prisma.Decimal | number | string | null;
    building?: { phase?: { project?: { name: Translatable } | null } | null } | null;
  } | null;
}

export interface SalesDetail {
  contracts: Array<{
    signedAt: Date | null;
    contractNumber: string;
    customer: string;
    project: string;
    unit: string;
    unitType: string;
    area: number | null;
    rep: string;
    broker: string;
    price: number;
  }>;
  contractsTotal: number;
  byRep: Array<{ name: string; count: number; total: number }>;
  byUnitType: Array<{ name: string; count: number; total: number; area: number }>;
  reservations: Array<{
    number: string;
    createdAt: Date;
    expiresAt: Date;
    customer: string;
    project: string;
    unit: string;
    rep: string;
    booking: number;
    bookingState: string;
    status: string;
    expired: boolean;
  }>;
}

export function buildSalesDetail(input: {
  contracts: SalesContractInput[];
  reservations: OpenReservationInput[];
  /** Company unit-type code → its Arabic name. */
  unitTypeName: (code: string) => string | undefined;
  projectName: (name: Translatable) => string;
  now: Date;
}): SalesDetail {
  const contracts = input.contracts.map((c) => {
    const price = commissionBasis(
      new Prisma.Decimal(c.totalAmount),
      c.reservation ?? undefined,
      new Prisma.Decimal(c.markupWaived ?? 0),
    ).toNumber();
    const project = c.unit?.building?.phase?.project;
    const code = c.unit?.type ?? null;
    return {
      signedAt: c.signedAt,
      contractNumber: c.contractNumber ?? '—',
      customer: c.customer?.fullName ?? '—',
      project: project ? input.projectName(project.name) : '—',
      unit: c.unit?.code ?? '—',
      unitType: code ? (input.unitTypeName(code) ?? code) : NO_TYPE,
      area: c.unit?.area ?? null,
      rep: c.reservation?.sales?.fullName ?? NO_REP,
      broker: c.broker ? input.projectName(c.broker.companyName) : '',
      price,
    };
  });

  const group = <K extends string>(key: (r: (typeof contracts)[number]) => K) => {
    const m = new Map<K, { count: number; total: number; area: number }>();
    for (const r of contracts) {
      const g = m.get(key(r)) ?? { count: 0, total: 0, area: 0 };
      g.count += 1;
      g.total += r.price;
      g.area += r.area ?? 0;
      m.set(key(r), g);
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  };

  const reservations = input.reservations.map((r) => {
    const project = r.unit?.building?.phase?.project;
    return {
      number: r.reservationNumber ?? '—',
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      customer: r.client?.fullName ?? r.lead?.fullName ?? '—',
      project: project ? input.projectName(project.name) : '—',
      unit: r.unit?.code ?? '—',
      rep: r.sales?.fullName ?? NO_REP,
      booking: new Prisma.Decimal(r.bookingAmount ?? 0).toNumber(),
      bookingState: BOOKING_PAYMENT_AR[r.bookingPaymentStatus] ?? r.bookingPaymentStatus,
      status: RESERVATION_STATUS_AR[r.status] ?? r.status,
      expired: r.expiresAt < input.now,
    };
  });

  return {
    contracts,
    contractsTotal: contracts.reduce((a, r) => a + r.price, 0),
    byRep: group((r) => r.rep).map(([name, g]) => ({ name, count: g.count, total: g.total })),
    byUnitType: group((r) => r.unitType).map(([name, g]) => ({ name, ...g })),
    reservations,
  };
}
