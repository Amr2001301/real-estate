import { notFound } from 'next/navigation';
import { api, safe } from '@/lib/api';
import { formatDate, tx } from '@/lib/format';
import { getLetterhead } from '@/lib/letterhead';
import { getLocale } from '@/lib/locale';
import type { Contract } from '@/lib/types';
import { printT } from '@/messages/print';
import {
  PrintAmounts,
  PrintDocument,
  PrintFields,
  PrintParties,
  PrintSection,
  PrintSignatures,
  PrintTable,
  companyNameOf,
  formatMoney,
  formatNumber,
} from '@/components/print/PrintDocument';

export const dynamic = 'force-dynamic';

type Params = Promise<{ id: string }>;

export default async function ContractPrintPage({ params }: { params: Params }) {
  const { id } = await params;

  const [contractResult, letterhead, locale] = await Promise.all([
    safe(api.get<Contract>(`/contracts/${id}`)),
    getLetterhead(),
    getLocale(),
  ]);

  if (contractResult.error || !contractResult.data) notFound();

  const c = contractResult.data;
  const t = printT(locale);
  const m = t.contract;
  const company = companyNameOf(letterhead, locale);
  const money = (v: string | number | null | undefined) => formatMoney(v, letterhead.currency, locale);
  const date = (v: string | null | undefined) => formatDate(v, locale);

  const customerName = c.customer?.fullName ?? '—';
  const building = c.unit?.building;
  const project = building?.phase?.project;
  const plan = c.installmentPlan;
  const installments = plan?.installments ?? [];
  const remaining = Number(c.totalAmount) - Number(c.downPayment);
  const scheduleTotal = installments.reduce((sum, i) => sum + Number(i.amount), 0);

  const installmentTone = (s: string) =>
    s === 'PAID' ? 'text-emerald-700' : s === 'OVERDUE' ? 'text-red-600' : 'text-slate-600';

  return (
    <PrintDocument
      letterhead={letterhead}
      locale={locale}
      eyebrow={m.eyebrow}
      title={m.title}
      reference={c.contractNumber}
      date={date(c.signedAt ?? c.createdAt)}
      status={c.signedAt ? { label: m.signed, tone: 'success' } : { label: m.unsigned, tone: 'warning' }}
      note={m.note(company)}
    >
      <PrintSection title={m.parties}>
        <PrintParties
          parties={[
            {
              role: m.seller,
              name: company,
              lines: [
                letterhead.registrationNumber && { label: m.fields.registration, value: letterhead.registrationNumber },
                letterhead.contactPhone && { label: m.fields.phone, value: letterhead.contactPhone },
                letterhead.contactEmail && { value: letterhead.contactEmail },
              ],
            },
            {
              role: m.buyer,
              name: customerName,
              lines: [
                c.customer?.phone && { label: m.fields.phone, value: c.customer.phone },
                c.customer?.email && { value: c.customer.email },
              ],
            },
          ]}
        />
      </PrintSection>

      <PrintSection title={m.unit}>
        <PrintFields
          items={[
            { label: m.fields.project, value: project ? tx(project.name, locale) : '—' },
            building && { label: m.fields.building, value: tx(building.name, locale) },
            { label: m.fields.unitCode, value: c.unit?.code ?? '—', ltr: true },
            { label: m.fields.unitType, value: c.unit?.type },
            c.unit?.area != null && { label: m.fields.area, value: `${formatNumber(c.unit.area, locale)} ${t.common.sqm}` },
            c.unit?.floor != null && { label: m.fields.floor, value: formatNumber(c.unit.floor, locale) },
            !!c.unit?.bedrooms && { label: m.fields.bedrooms, value: formatNumber(c.unit.bedrooms, locale) },
          ]}
        />
      </PrintSection>

      <PrintSection title={m.terms}>
        <PrintFields
          items={[
            { label: m.fields.contractNumber, value: c.contractNumber ?? '—', ltr: true },
            { label: m.fields.createdAt, value: date(c.createdAt) },
            c.signedAt && { label: m.fields.signedAt, value: date(c.signedAt) },
            c.reservation?.reservationNumber && {
              label: m.fields.reservationNumber,
              value: c.reservation.reservationNumber,
              ltr: true,
            },
            c.reservation?.sales && { label: m.fields.sales, value: c.reservation.sales.fullName },
            c.broker && { label: m.fields.broker, value: c.broker.commercialName ?? c.broker.companyName },
          ]}
        />
      </PrintSection>

      <PrintSection title={m.financial}>
        <PrintAmounts
          rows={[
            { label: m.amounts.total, value: money(c.totalAmount), emphasis: true },
            { label: m.amounts.downPayment, value: money(c.downPayment) },
            Number.isFinite(remaining) && remaining > 0 && { label: m.amounts.remaining, value: money(remaining) },
            plan && { label: m.amounts.frequency, value: m.frequency[plan.frequency] ?? plan.frequency },
            plan && { label: m.amounts.duration, value: t.common.months(plan.totalMonths) },
            plan && { label: m.amounts.periodic, value: money(plan.monthlyAmount) },
            plan && { label: m.amounts.firstDue, value: date(plan.startsAt) },
          ]}
        />
      </PrintSection>

      {installments.length > 0 && (
        <PrintSection title={m.schedule}>
          <PrintTable
            head={[m.cols.no, m.cols.due, m.cols.amount, m.cols.status]}
            align={['start', 'start', 'end', 'end']}
            rows={installments.map((inst, i) => [
              <span key="n" className="text-slate-400">{formatNumber(i + 1, locale)}</span>,
              date(inst.dueDate),
              <span key="a" className="font-medium">{money(inst.amount)}</span>,
              <span key="s" className={installmentTone(inst.status)}>
                {m.installmentStatus[inst.status] ?? inst.status}
              </span>,
            ])}
            foot={[t.common.total, '', money(scheduleTotal), '']}
          />
        </PrintSection>
      )}

      <PrintSignatures
        locale={locale}
        parties={[
          { role: m.buyerSignature, name: customerName },
          { role: m.sellerSignature, name: company },
        ]}
      />
    </PrintDocument>
  );
}
