import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Locale } from '@/lib/locale';
import type { ContractStatement } from '@/lib/types';
import { statementLineLabel, statementLineNote } from '@/components/payments/statement';

/**
 * Statement of account (كشف حساب): where the customer stands today, and every
 * charge, payment and reversal that got them there with the balance after each.
 */
export function StatementPanel({
  statement: s,
  currency,
  locale,
}: {
  statement: ContractStatement;
  currency: string;
  locale: Locale;
}) {
  const en = locale === 'en';
  const money = (v: string | number) => formatCurrency(v, currency, locale);
  const fmt = (d: string) => formatDate(d, locale);
  const t = s.totals;
  const figures: Array<{ key: string; label: string; value: string; cls: string; hide?: boolean }> =
    [
      {
        key: 'balance',
        label: en ? 'Left on the contract' : 'المتبقي على العقد',
        value: t.balance,
        cls: 'text-slate-900',
      },
      {
        key: 'overdue',
        label: en ? 'Late' : 'متأخر',
        value: t.overdue,
        cls: Number(t.overdue) > 0 ? 'text-danger-600' : 'text-emerald-600',
      },
      {
        key: 'due-today',
        label: en ? 'Due today' : 'مستحق اليوم',
        value: t.dueToday,
        cls: 'text-amber-600',
        hide: Number(t.dueToday) === 0,
      },
      {
        key: 'upcoming',
        label: en ? 'Not due yet' : 'لم يحن موعده',
        value: t.upcoming,
        cls: 'text-slate-600',
      },
      {
        key: 'unscheduled',
        label: en ? 'Not on the schedule' : 'غير مجدول',
        value: t.unscheduled,
        cls: 'text-amber-600',
        hide: Number(t.unscheduled) === 0,
      },
      {
        key: 'awaiting',
        label: en ? 'Awaiting confirmation' : 'بانتظار التأكيد',
        value: t.awaiting,
        cls: 'text-sky-600',
        hide: Number(t.awaiting) === 0,
      },
    ];

  return (
    <div data-testid="statement">
      <div className="mx-6 mb-5 flex flex-wrap gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline">
        {figures
          .filter((f) => !f.hide)
          .map((f) => (
            <div
              key={f.key}
              className="min-w-[140px] flex-1 bg-surface px-4 py-3"
              data-testid={`statement-${f.key}`}
            >
              <p className="text-[11.5px] text-slate-500">{f.label}</p>
              <p className={cn('mt-0.5 text-[15px] font-bold tabular-nums', f.cls)}>
                {money(f.value)}
              </p>
            </div>
          ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[12.5px]">
          <thead>
            <tr className="border-y border-hairline bg-surface-muted/40 text-[11.5px] font-semibold text-slate-500">
              <th className="px-5 py-2.5 text-start">{en ? 'Date' : 'التاريخ'}</th>
              <th className="px-4 py-2.5 text-start">{en ? 'Description' : 'البيان'}</th>
              <th className="px-4 py-2.5 text-end">{en ? 'Charge' : 'مدين'}</th>
              <th className="px-4 py-2.5 text-end">{en ? 'Paid' : 'دائن'}</th>
              <th className="px-5 py-2.5 text-end">{en ? 'Balance' : 'الرصيد'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {s.lines.map((l, i) => {
              const note = statementLineNote(l, locale);
              return (
                <tr
                  key={i}
                  data-testid="statement-line"
                  data-kind={l.kind}
                  className={cn(l.kind === 'REVERSAL' && 'bg-danger-500/[0.04]')}
                >
                  <td className="whitespace-nowrap px-5 py-2.5 tabular-nums text-slate-600">
                    {fmt(l.date)}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {statementLineLabel(l, fmt, locale)}
                    {note && (
                      <span className="mt-0.5 block text-[11.5px] text-slate-400">{note}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-end tabular-nums text-slate-700">
                    {Number(l.debit) ? money(l.debit) : ''}
                  </td>
                  <td className="px-4 py-2.5 text-end tabular-nums text-emerald-600">
                    {Number(l.credit) ? money(l.credit) : ''}
                  </td>
                  <td className="px-5 py-2.5 text-end font-semibold tabular-nums text-slate-900">
                    {money(l.balance)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-hairline font-bold">
              <td className="px-5 py-3 text-slate-600" colSpan={2}>
                {en ? `Balance as of ${fmt(s.asOf)}` : `الرصيد حتى ${fmt(s.asOf)}`}
              </td>
              <td className="px-4 py-3 text-end tabular-nums text-slate-700">
                {money(Number(t.contractValue) + Number(t.fees))}
              </td>
              <td className="px-4 py-3 text-end tabular-nums text-emerald-600">{money(t.paid)}</td>
              <td
                className="px-5 py-3 text-end tabular-nums text-slate-900"
                data-testid="statement-closing"
              >
                {money(t.balance)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {Number(t.unscheduled) > 0 && (
        <p
          className="mx-6 mt-3 text-[11.5px] text-amber-600"
          data-testid="statement-unscheduled-note"
        >
          {en
            ? 'Part of the contract value has no schedule row and no payment recorded. Record the payment if it was made, or add it to the schedule.'
            : 'جزء من قيمة العقد ليس له صف في الجدول ولا دفعة مسجّلة — سجّل الدفعة لو اتدفعت، أو أضفه للجدول.'}
        </p>
      )}
      {s.awaiting.length > 0 && (
        <p className="mx-6 mt-3 text-[11.5px] text-slate-500">
          {en
            ? 'Payments awaiting confirmation (a proof to review, a cheque not cleared) are not in the balance until they are confirmed.'
            : 'الدفعات بانتظار التأكيد (إيصال للمراجعة أو شيك لم يُصرف) لا تُحسب في الرصيد حتى تتأكد.'}
        </p>
      )}
    </div>
  );
}
