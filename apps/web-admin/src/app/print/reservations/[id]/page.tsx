import { notFound } from 'next/navigation';
import { api, safe } from '@/lib/api';
import { formatDate, tx } from '@/lib/format';
import { getLetterhead } from '@/lib/letterhead';
import { getLocale } from '@/lib/locale';
import type { Reservation } from '@/lib/types';
import { printT } from '@/messages/print';
import {
  PrintAmounts,
  PrintDocument,
  PrintFields,
  PrintSection,
  PrintSignatures,
  companyNameOf,
  formatMoney,
  formatNumber,
  type PrintTone,
} from '@/components/print/PrintDocument';

export const dynamic = 'force-dynamic';

type Params = Promise<{ id: string }>;

const STATUS_TONE: Record<string, PrintTone> = {
  PENDING: 'warning',
  APPROVED: 'success',
  CONVERTED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'danger',
  EXPIRED: 'neutral',
};

/** Statuses after which the slip no longer holds the unit. */
const VOID = new Set(['REJECTED', 'CANCELLED', 'EXPIRED']);

export default async function ReservationPrintPage({ params }: { params: Params }) {
  const { id } = await params;

  const [resResult, letterhead, locale] = await Promise.all([
    safe(api.get<Reservation>(`/reservations/${id}`)),
    getLetterhead(),
    getLocale(),
  ]);

  if (resResult.error || !resResult.data) notFound();

  const r = resResult.data;
  const t = printT(locale);
  const m = t.reservation;
  const company = companyNameOf(letterhead, locale);
  const money = (v: string | number | null | undefined) => formatMoney(v, letterhead.currency, locale);
  const date = (v: string | null | undefined) => formatDate(v, locale);

  const clientName = r.client?.fullName ?? r.lead?.fullName ?? '—';
  const building = r.unit?.building;
  const project = building?.phase?.project;
  const statusLabel = m.status[r.status] ?? r.status;

  return (
    <PrintDocument
      letterhead={letterhead}
      locale={locale}
      eyebrow={m.eyebrow}
      title={m.title}
      reference={r.reservationNumber}
      date={date(r.createdAt)}
      status={{ label: statusLabel, tone: STATUS_TONE[r.status] ?? 'neutral' }}
      watermark={VOID.has(r.status) ? statusLabel : undefined}
      note={m.note(company)}
    >
      <PrintSection title={m.client}>
        <PrintFields
          items={[
            { label: m.fields.name, value: clientName },
            { label: m.fields.phone, value: r.client?.phone ?? r.lead?.phone, ltr: true },
            { label: m.fields.email, value: r.client?.email ?? r.lead?.email, ltr: true },
          ]}
        />
      </PrintSection>

      <PrintSection title={m.unit}>
        <PrintFields
          items={[
            { label: m.fields.project, value: project ? tx(project.name, locale) : '—' },
            building && { label: m.fields.building, value: tx(building.name, locale) },
            { label: m.fields.unitCode, value: r.unit?.code ?? '—', ltr: true },
            { label: m.fields.unitType, value: r.unit?.type },
            r.unit?.area != null && { label: m.fields.area, value: `${formatNumber(r.unit.area, locale)} ${t.common.sqm}` },
            r.unit?.floor != null && { label: m.fields.floor, value: formatNumber(r.unit.floor, locale) },
          ]}
        />
      </PrintSection>

      <PrintSection title={m.details}>
        <PrintFields
          items={[
            { label: m.fields.reservationNumber, value: r.reservationNumber ?? '—', ltr: true },
            { label: m.fields.createdAt, value: date(r.createdAt) },
            { label: m.fields.expiresAt, value: date(r.expiresAt) },
            r.contract?.contractNumber && {
              label: m.fields.contractNumber,
              value: r.contract.contractNumber,
              ltr: true,
            },
            r.notes && { label: m.fields.notes, value: r.notes, wide: true },
          ]}
        />
      </PrintSection>

      <PrintSection title={m.financial}>
        <PrintAmounts
          rows={[
            { label: m.amounts.booking, value: money(r.bookingAmount), emphasis: true },
            r.snapshotDownPaymentAmount != null && {
              label: m.amounts.downPayment,
              value: money(r.snapshotDownPaymentAmount),
            },
            r.snapshotFinancedAmount != null && { label: m.amounts.financed, value: money(r.snapshotFinancedAmount) },
            r.selectedDurationMonths != null && {
              label: m.amounts.duration,
              value: t.common.months(r.selectedDurationMonths),
            },
            r.snapshotMonthlyInstallment != null && {
              label: m.amounts.monthly,
              value: money(r.snapshotMonthlyInstallment),
            },
            r.snapshotTotalPayable != null && { label: m.amounts.total, value: money(r.snapshotTotalPayable) },
          ]}
        />
      </PrintSection>

      <PrintSignatures
        locale={locale}
        parties={[
          { role: m.clientSignature, name: clientName },
          { role: m.companySignature, name: company },
        ]}
      />
    </PrintDocument>
  );
}
