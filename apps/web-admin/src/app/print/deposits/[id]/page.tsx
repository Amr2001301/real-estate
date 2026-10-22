import { notFound } from 'next/navigation';
import { api, safe } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { getLetterhead } from '@/lib/letterhead';
import { getLocale } from '@/lib/locale';
import { getPrintSettings, sealFor } from '@/lib/print-settings';
import type { Deposit } from '@/lib/types';
import { getCustomerFields } from '@/lib/customer-fields-server';
import { receiptValues, type ReceiptPayer } from '@/lib/document-values';
import { fillForm } from '@/lib/form-layout';
import { getFormLayouts, pickForm } from '@/lib/form-layout-server';
import { FormPrint } from '@/components/print/FormPrint';
import { printT } from '@/messages/print';
import {
  PrintDocument,
  PrintFields,
  PrintSection,
  PrintSignatures,
  companyNameOf,
  formatMoney,
  type PrintTone,
} from '@/components/print/PrintDocument';

export const dynamic = 'force-dynamic';

type Params = Promise<{ id: string }>;
type Search = Promise<{ form?: string }>;

const REVIEW_TONE: Record<string, PrintTone> = {
  APPROVED: 'success',
  PENDING_REVIEW: 'warning',
  REJECTED: 'danger',
  NO_PROOF: 'success',
};

export default async function DepositPrintPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { id } = await params;
  const { form: requestedForm } = await searchParams;

  const [depositResult, letterhead, locale, paper, forms] = await Promise.all([
    safe(api.get<Deposit>(`/deposits/${id}`)),
    getLetterhead(),
    getLocale(),
    getPrintSettings(),
    getFormLayouts('RECEIPT'),
  ]);

  if (depositResult.error || !depositResult.data) notFound();

  const d = depositResult.data;
  const t = printT(locale);
  const m = t.deposit;
  const company = companyNameOf(letterhead, locale);
  const money = (v: string | number | null | undefined) => formatMoney(v, letterhead.currency, locale);
  const date = (v: string | null | undefined) => formatDate(v, locale);

  const clientName =
    d.reservation?.client?.fullName ??
    d.reservation?.lead?.fullName ??
    d.contract?.customer?.fullName ??
    '—';
  const unitCode = d.reservation?.unit?.code ?? d.contract?.unit?.code ?? null;
  const reference = d.id.slice(-8).toUpperCase();
  const typeLabel = m.type[d.type] ?? d.type;

  const watermark = d.deletedAt ? m.voided : d.reviewStatus === 'REJECTED' ? m.rejected : undefined;
  const status = d.reviewStatus
    ? { label: m.review[d.reviewStatus] ?? d.reviewStatus, tone: REVIEW_TONE[d.reviewStatus] ?? 'neutral' }
    : undefined;

  // The company's signature and stamp on a receipt for money it accepted.
  const seal = sealFor(
    paper,
    'RECEIPT',
    !d.deletedAt && (d.reviewStatus === 'APPROVED' || d.reviewStatus === 'NO_PROOF'),
  );

  // The company's own receipt, when it has one: its paper with the values,
  // signature and stamp where the company placed them.
  const form = pickForm(forms, requestedForm);
  const formSwitcher = forms.length
    ? {
        label: t.common.form,
        param: 'form',
        current: form?.id ?? 'none',
        options: [...forms.map((f) => ({ id: f.id, name: f.name })), { id: 'none', name: t.common.standardLayout }],
      }
    : undefined;
  if (form) {
    const payerId = d.contract?.customer?.id ?? d.reservation?.client?.id;
    const [payer, fields] = await Promise.all([
      payerId ? safe(api.get<ReceiptPayer>(`/users/${payerId}`)).then((r) => r.data ?? null) : null,
      getCustomerFields(),
    ]);
    return (
      <FormPrint
        title={m.title}
        locale={locale}
        pages={form.pages}
        paperSize={form.paperSize}
        fields={fillForm(form, receiptValues(d, payer, letterhead, paper, locale, fields), {
          'sign.company': seal?.signature ?? null,
          'sign.stamp': seal?.stamp ?? null,
        })}
        switcher={formSwitcher}
        watermark={watermark}
      />
    );
  }

  return (
    <PrintDocument
      switcher={formSwitcher}
      letterhead={letterhead}
      locale={locale}
      eyebrow={m.eyebrow}
      title={m.title}
      reference={reference}
      date={date(d.paidAt)}
      status={status}
      watermark={watermark}
      note={m.note(company)}
      paper={paper}
    >
      {/* The receipt sentence, as on a printed receipt book. */}
      <section
        className="mt-6 rounded-xl border-2 px-5 py-4"
        style={{ borderColor: 'var(--accent)' }}
      >
        <p className="text-sm leading-8 text-slate-700">
          {m.received} <strong className="text-slate-900">{clientName}</strong> {m.sumOf}{' '}
          <strong data-testid="print-amount-total" className="text-lg" style={{ color: 'var(--brand)' }}>
            {money(d.amount)}
          </strong>{' '}
          {m.forPayment} <strong className="text-slate-900">{typeLabel}</strong>
          {unitCode && (
            <>
              {' '}
              {m.forUnit} <strong className="whitespace-nowrap text-slate-900" dir="ltr">{unitCode}</strong>
            </>
          )}
          .
        </p>
      </section>

      <PrintSection title={m.details}>
        <PrintFields
          items={[
            { label: m.fields.type, value: typeLabel },
            { label: m.fields.amount, value: money(d.amount) },
            { label: m.fields.paidAt, value: date(d.paidAt) },
            d.paymentMethod && { label: m.fields.method, value: m.method[d.paymentMethod] ?? d.paymentMethod },
            d.reviewedAt && d.reviewedBy && {
              label: m.fields.reviewedBy,
              value: `${d.reviewedBy.fullName} — ${date(d.reviewedAt)}`,
            },
          ]}
        />
      </PrintSection>

      <PrintSection title={m.links}>
        <PrintFields
          items={[
            { label: m.fields.client, value: clientName },
            unitCode && { label: m.fields.unit, value: unitCode, ltr: true },
            d.contract?.contractNumber && {
              label: m.fields.contractNumber,
              value: d.contract.contractNumber,
              ltr: true,
            },
            d.reservation?.reservationNumber && {
              label: m.fields.reservationNumber,
              value: d.reservation.reservationNumber,
              ltr: true,
            },
          ]}
        />
      </PrintSection>

      {d.installment && (
        <PrintSection title={m.installment}>
          <PrintFields
            items={[
              { label: m.fields.due, value: date(d.installment.dueDate) },
              { label: m.fields.installmentAmount, value: money(d.installment.amount) },
            ]}
          />
        </PrintSection>
      )}

      <PrintSignatures
        locale={locale}
        seal={seal}
        parties={[
          { role: m.payerSignature, name: clientName },
          { role: m.receiverSignature, name: company, company: true },
        ]}
      />
    </PrintDocument>
  );
}
