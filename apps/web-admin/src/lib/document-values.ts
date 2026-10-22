import { formatDate, tx } from './format';
import type { Letterhead } from './letterhead';
import type { Locale } from './locale';
import type { PrintSettings } from './print-settings';
import type { Contract, CustomerRecord, Deposit, Reservation } from './types';
import { FIXED_DETAILS, customValueText, formatDay, type CustomerFieldDef } from './customer-fields';
import { amountInWords, customPlaceholder, type TemplateValues } from './document-template';
import { formatMoney, formatNumber, companyNameOf } from '@/components/print/PrintDocument';
import { printT } from '@/messages/print';

/** Placeholder values every document shares: the company and today. */
function companyValues(letterhead: Letterhead, paper: PrintSettings, locale: Locale): TemplateValues {
  const address = letterhead.contactAddress;
  return {
    'company.name': companyNameOf(letterhead, locale),
    'company.registration': letterhead.registrationNumber,
    'company.address':
      typeof address === 'string' ? address : address && typeof address === 'object' && 'ar' in address ? tx(address as { ar: string; en: string }, locale) : null,
    'company.phone': letterhead.contactPhone,
    'company.signatory': paper.signatoryName,
    'company.signatoryTitle': paper.signatoryTitle,
    today: formatDate(new Date(), locale),
  };
}

/** The buyer's recorded details and the company's own fields. */
function customerRecordValues(c: CustomerRecord | null | undefined, fields: CustomerFieldDef[], locale: Locale): TemplateValues {
  const out: TemplateValues = {
    'customer.nationalId': c?.nationalId,
    'customer.address': c?.address,
  };
  for (const d of FIXED_DETAILS) {
    const v = c?.[d.key] as string | null | undefined;
    out[d.placeholder] = 'date' in d && d.date ? formatDay(v, locale) : v;
  }
  for (const f of fields) out[customPlaceholder(f.key)] = customValueText(f, c?.customFields?.[f.key], locale);
  return out;
}

type UnitLike = Contract['unit'] | Reservation['unit'];

function unitValues(unit: UnitLike, locale: Locale): TemplateValues {
  const building = unit?.building;
  const project = building?.phase?.project;
  return {
    'unit.code': unit?.code,
    'unit.type': unit?.type,
    'unit.area': unit?.area != null ? formatNumber(unit.area, locale) : null,
    'unit.floor': unit?.floor != null ? formatNumber(unit.floor, locale) : null,
    'unit.building': building ? tx(building.name, locale) : null,
    'unit.project': project ? tx(project.name, locale) : null,
  };
}

/** A contract's placeholder values. */
export function contractValues(
  c: Contract,
  letterhead: Letterhead,
  paper: PrintSettings,
  locale: Locale,
  fields: CustomerFieldDef[] = [],
): TemplateValues {
  const money = (v: string | number | null | undefined) => (v == null ? null : formatMoney(v, letterhead.currency, locale));
  const date = (v: string | null | undefined) => (v ? formatDate(v, locale) : null);
  const plan = c.installmentPlan;
  const rows = (plan?.installments ?? []).filter((i) => i.type === 'INSTALLMENT');
  const remaining = Number(c.totalAmount) - Number(c.downPayment);
  return {
    ...companyValues(letterhead, paper, locale),
    'customer.name': c.customer?.fullName,
    'customer.phone': c.customer?.phone,
    'customer.email': c.customer?.email,
    ...customerRecordValues(c.customer, fields, locale),
    ...unitValues(c.unit, locale),
    'contract.number': c.contractNumber,
    'contract.date': date(c.signedAt ?? c.createdAt),
    'contract.total': money(c.totalAmount),
    'contract.totalWords': amountInWords(c.totalAmount, letterhead.currency, locale),
    'contract.downPayment': money(c.downPayment),
    'contract.downPaymentWords': amountInWords(c.downPayment, letterhead.currency, locale),
    'contract.remaining': Number.isFinite(remaining) ? money(remaining) : null,
    'contract.deliveryDate': date(c.deliveryDate),
    'plan.count': rows.length ? formatNumber(rows.length, locale) : null,
    'plan.installment': plan ? money(plan.monthlyAmount) : null,
    'plan.frequency': plan ? (printT(locale).contract.frequency[plan.frequency] ?? plan.frequency) : null,
    'plan.months': plan ? formatNumber(plan.totalMonths, locale) : null,
    'plan.firstDue': date(rows[0]?.dueDate ?? plan?.startsAt),
    'plan.lastDue': date(rows[rows.length - 1]?.dueDate),
    'reservation.number': c.reservation?.reservationNumber,
  };
}

/** A booking's placeholder values. */
export function reservationValues(
  r: Reservation,
  letterhead: Letterhead,
  paper: PrintSettings,
  locale: Locale,
  fields: CustomerFieldDef[] = [],
): TemplateValues {
  return {
    ...companyValues(letterhead, paper, locale),
    'customer.name': r.client?.fullName ?? r.lead?.fullName,
    'customer.phone': r.client?.phone ?? r.lead?.phone,
    'customer.email': r.client?.email ?? r.lead?.email,
    ...customerRecordValues(r.client, fields, locale),
    ...unitValues(r.unit, locale),
    'reservation.number': r.reservationNumber,
    'reservation.date': formatDate(r.createdAt, locale),
    'reservation.amount': formatMoney(r.bookingAmount, letterhead.currency, locale),
    'reservation.amountWords': amountInWords(r.bookingAmount, letterhead.currency, locale),
    'reservation.expiresAt': formatDate(r.expiresAt, locale),
  };
}

/** A contract with no instalments is a cash sale. */
export function contractVariant(c: Contract): 'CASH' | 'INSTALLMENT' {
  return (c.installmentPlan?.installments ?? []).some((i) => i.type === 'INSTALLMENT') ? 'INSTALLMENT' : 'CASH';
}

/** The payer of a receipt, as the customer endpoint returns them (when they have an account). */
export type ReceiptPayer = { fullName: string; phone?: string | null; email?: string | null } & CustomerRecord;

/** A payment receipt's placeholder values (the receipt prints only on the company's own paper). */
export function receiptValues(
  d: Deposit,
  payer: ReceiptPayer | null,
  letterhead: Letterhead,
  paper: PrintSettings,
  locale: Locale,
  fields: CustomerFieldDef[] = [],
): TemplateValues {
  const m = printT(locale).deposit;
  const name = payer?.fullName ?? d.reservation?.client?.fullName ?? d.reservation?.lead?.fullName ?? d.contract?.customer?.fullName;
  return {
    ...companyValues(letterhead, paper, locale),
    'customer.name': name,
    'customer.phone': payer?.phone,
    'customer.email': payer?.email,
    ...customerRecordValues(payer, fields, locale),
    'unit.code': d.reservation?.unit?.code ?? d.contract?.unit?.code,
    'contract.number': d.contract?.contractNumber,
    'reservation.number': d.reservation?.reservationNumber,
    'receipt.number': d.id.slice(-8).toUpperCase(),
    'receipt.date': formatDate(d.paidAt, locale),
    'receipt.amount': formatMoney(d.amount, letterhead.currency, locale),
    'receipt.amountWords': amountInWords(d.amount, letterhead.currency, locale),
    'receipt.for': m.type[d.type] ?? d.type,
    'receipt.method': d.paymentMethod ? (m.method[d.paymentMethod] ?? d.paymentMethod) : null,
    'receipt.chequeNumber': d.paymentInstrument?.chequeNumber,
    'receipt.installmentDue': d.installment ? formatDate(d.installment.dueDate, locale) : null,
  };
}
