import { formatDate, tx } from './format';
import type { Letterhead } from './letterhead';
import type { Locale } from './locale';
import type { PrintSettings } from './print-settings';
import type { Contract, Reservation } from './types';
import { amountInWords, type TemplateValues } from './document-template';
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
export function contractValues(c: Contract, letterhead: Letterhead, paper: PrintSettings, locale: Locale): TemplateValues {
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
    'customer.nationalId': c.customer?.nationalId,
    'customer.address': c.customer?.address,
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
export function reservationValues(r: Reservation, letterhead: Letterhead, paper: PrintSettings, locale: Locale): TemplateValues {
  return {
    ...companyValues(letterhead, paper, locale),
    'customer.name': r.client?.fullName ?? r.lead?.fullName,
    'customer.phone': r.client?.phone ?? r.lead?.phone,
    'customer.email': r.client?.email ?? r.lead?.email,
    'customer.nationalId': r.client?.nationalId,
    'customer.address': r.client?.address,
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
