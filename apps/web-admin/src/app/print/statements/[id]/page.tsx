import { notFound } from 'next/navigation';
import { api, safe } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { getLetterhead } from '@/lib/letterhead';
import { getLocale } from '@/lib/locale';
import type { Contract, ContractStatement } from '@/lib/types';
import { statementLineLabel, statementLineNote } from '@/components/payments/statement';
import {
  PrintAmounts,
  PrintDocument,
  PrintFields,
  PrintSection,
  PrintTable,
  formatMoney,
} from '@/components/print/PrintDocument';

export const dynamic = 'force-dynamic';

type Params = Promise<{ id: string }>;

/** Printable statement of account (كشف حساب) for one contract. */
export default async function StatementPrintPage({ params }: { params: Params }) {
  const { id } = await params;

  const [contractResult, statementResult, letterhead, locale] = await Promise.all([
    safe(api.get<Contract>(`/contracts/${id}`)),
    safe(api.get<ContractStatement>(`/contracts/${id}/statement`)),
    getLetterhead(),
    getLocale(),
  ]);

  if (!contractResult.data || !statementResult.data) notFound();

  const c = contractResult.data;
  const s = statementResult.data;
  const en = locale === 'en';
  const money = (v: string | number | null | undefined) =>
    formatMoney(v, letterhead.currency, locale);
  const date = (v: string) => formatDate(v, locale);
  const t = s.totals;

  return (
    <PrintDocument
      letterhead={letterhead}
      locale={locale}
      eyebrow={en ? 'Statement' : 'كشف حساب'}
      title={en ? 'Customer statement of account' : 'كشف حساب عميل'}
      reference={c.contractNumber}
      date={date(s.asOf)}
    >
      <PrintSection title={en ? 'Contract' : 'بيانات العقد'}>
        <PrintFields
          items={[
            { label: en ? 'Customer' : 'العميل', value: c.customer?.fullName ?? '—' },
            c.contractNumber && {
              label: en ? 'Contract no.' : 'رقم العقد',
              value: c.contractNumber,
              ltr: true,
            },
            c.unit?.code && { label: en ? 'Unit' : 'الوحدة', value: c.unit.code, ltr: true },
            { label: en ? 'As of' : 'حتى تاريخ', value: date(s.asOf) },
          ]}
        />
      </PrintSection>

      <PrintSection title={en ? 'Summary' : 'الملخص'}>
        <PrintAmounts
          rows={[
            { label: en ? 'Contract value' : 'قيمة العقد', value: money(t.contractValue) },
            Number(t.fees) > 0 && {
              label: en ? 'Fees and penalties' : 'رسوم وغرامات',
              value: money(t.fees),
            },
            { label: en ? 'Paid' : 'المسدد', value: money(t.paid) },
            Number(t.overdue) > 0 && { label: en ? 'Late' : 'متأخر', value: money(t.overdue) },
            Number(t.dueToday) > 0 && {
              label: en ? 'Due today' : 'مستحق اليوم',
              value: money(t.dueToday),
            },
            Number(t.upcoming) > 0 && {
              label: en ? 'Not due yet' : 'لم يحن موعده',
              value: money(t.upcoming),
            },
            Number(t.unscheduled) > 0 && {
              label: en ? 'Not on the schedule' : 'غير مجدول',
              value: money(t.unscheduled),
            },
            Number(t.awaiting) > 0 && {
              label: en ? 'Awaiting confirmation' : 'بانتظار التأكيد',
              value: money(t.awaiting),
            },
            {
              label: en ? 'Left on the contract' : 'المتبقي على العقد',
              value: money(t.balance),
              emphasis: true,
            },
          ]}
        />
      </PrintSection>

      <PrintSection title={en ? 'Transactions' : 'الحركات'}>
        <PrintTable
          head={
            en
              ? ['Date', 'Description', 'Charge', 'Paid', 'Balance']
              : ['التاريخ', 'البيان', 'مدين', 'دائن', 'الرصيد']
          }
          align={['start', 'start', 'end', 'end', 'end']}
          rows={s.lines.map((l) => {
            const note = statementLineNote(l, locale);
            return [
              <span key="d" className="whitespace-nowrap">
                {date(l.date)}
              </span>,
              <span key="l">
                {statementLineLabel(l, date, locale)}
                {note && <span className="block text-[10px] text-slate-400">{note}</span>}
              </span>,
              Number(l.debit) ? money(l.debit) : '',
              Number(l.credit) ? money(l.credit) : '',
              <span key="b" className="font-medium">
                {money(l.balance)}
              </span>,
            ];
          })}
          foot={[
            en ? 'Total' : 'الإجمالي',
            '',
            money(Number(t.contractValue) + Number(t.fees)),
            money(t.paid),
            money(t.balance),
          ]}
        />
      </PrintSection>
    </PrintDocument>
  );
}
