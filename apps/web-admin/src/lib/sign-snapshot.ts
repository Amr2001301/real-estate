import { formatDate, tx } from './format';
import type { Letterhead } from './letterhead';
import type { Locale } from './locale';
import type { DocumentTemplate, PrintSettings } from './print-settings';
import type { Reservation } from './types';
import { renderTemplate, type TemplateBlock } from './document-template';
import { reservationValues } from './document-values';
import { companyNameOf, formatMoney, formatNumber } from '@/components/print/PrintDocument';
import { printT } from '@/messages/print';

/**
 * The document a customer signs online, laid out once when the link is sent
 * and kept as sent: the signing page shows exactly this, and its hash is what
 * the signature vouches for. Read by the public website (web-public), so the
 * shape is versioned.
 */
export interface SignSnapshot {
  version: 1;
  locale: Locale;
  company: {
    name: string;
    logoUrl: string | null;
    primaryColor: string | null;
    accentColor: string | null;
    registration: string | null;
    phone: string | null;
  };
  eyebrow: string;
  title: string;
  reference: string | null;
  date: string;
  sections: { title: string; rows: { label: string; value: string }[] }[];
  amounts: { label: string; value: string; emphasis?: boolean }[];
  clausesTitle: string;
  clauses: TemplateBlock[];
}

const present = (rows: { label: string; value: string | null | undefined | false }[]) =>
  rows.filter((r): r is { label: string; value: string } => !!r.value);

/** A booking form for the customer's signature. */
export function reservationSnapshot(
  r: Reservation,
  letterhead: Letterhead,
  paper: PrintSettings,
  template: DocumentTemplate | null,
  locale: Locale,
): SignSnapshot {
  const t = printT(locale);
  const m = t.reservation;
  const money = (v: string | number | null | undefined) => formatMoney(v, letterhead.currency, locale);
  const building = r.unit?.building;
  const project = building?.phase?.project;
  return {
    version: 1,
    locale,
    company: {
      name: companyNameOf(letterhead, locale),
      logoUrl: letterhead.logoUrl ?? null,
      primaryColor: letterhead.primaryColor ?? null,
      accentColor: letterhead.accentColor ?? null,
      registration: letterhead.registrationNumber ?? null,
      phone: letterhead.contactPhone ?? null,
    },
    eyebrow: m.eyebrow,
    title: m.title,
    reference: r.reservationNumber,
    date: formatDate(r.createdAt, locale),
    sections: [
      {
        title: m.client,
        rows: present([
          { label: m.fields.name, value: r.client?.fullName ?? r.lead?.fullName },
          { label: m.fields.nationalId, value: r.client?.nationalId },
          { label: m.fields.phone, value: r.client?.phone ?? r.lead?.phone },
          { label: m.fields.address, value: r.client?.address },
        ]),
      },
      {
        title: m.unit,
        rows: present([
          { label: m.fields.project, value: project ? tx(project.name, locale) : null },
          { label: m.fields.building, value: building ? tx(building.name, locale) : null },
          { label: m.fields.unitCode, value: r.unit?.code },
          { label: m.fields.unitType, value: r.unit?.type },
          { label: m.fields.area, value: r.unit?.area != null ? `${formatNumber(r.unit.area, locale)} ${t.common.sqm}` : null },
          { label: m.fields.floor, value: r.unit?.floor != null ? formatNumber(r.unit.floor, locale) : null },
        ]),
      },
      {
        title: m.details,
        rows: present([
          { label: m.fields.reservationNumber, value: r.reservationNumber },
          { label: m.fields.createdAt, value: formatDate(r.createdAt, locale) },
          { label: m.fields.expiresAt, value: formatDate(r.expiresAt, locale) },
        ]),
      },
    ],
    amounts: [
      { label: m.amounts.booking, value: money(r.bookingAmount), emphasis: true },
      ...present([
        { label: m.amounts.downPayment, value: r.snapshotDownPaymentAmount != null ? money(r.snapshotDownPaymentAmount) : null },
        { label: m.amounts.financed, value: r.snapshotFinancedAmount != null ? money(r.snapshotFinancedAmount) : null },
        { label: m.amounts.duration, value: r.selectedDurationMonths != null ? t.common.months(r.selectedDurationMonths) : null },
        { label: m.amounts.monthly, value: r.snapshotMonthlyInstallment != null ? money(r.snapshotMonthlyInstallment) : null },
        { label: m.amounts.total, value: r.snapshotTotalPayable != null ? money(r.snapshotTotalPayable) : null },
      ]),
    ],
    clausesTitle: t.common.clauses,
    clauses: template ? renderTemplate(template.body, reservationValues(r, letterhead, paper, locale)) : [],
  };
}
