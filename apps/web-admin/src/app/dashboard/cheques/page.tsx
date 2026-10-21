import Link from 'next/link';
import { AlertCircle, Landmark, Search, Hash } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import { getLocale } from '@/lib/locale';
import type { Paged, PaymentInstrument, PaymentInstrumentStatus } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/format';
import { getReportsCurrency } from '@/lib/currency';
import { cn } from '@/lib/cn';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import {
  PremiumPageHero,
  PremiumFilterBar,
  PremiumFilterField,
  PremiumSectionCard,
  PremiumEmptyState,
} from '@/components/premium';
import { CodeCell, PersonCell } from '@/components/premium/list-cells';
import { uiT } from '@/messages/ui';
import { ChequeActions } from './_actions';

export const dynamic = 'force-dynamic';

// FG-01 — the treasurer's view of customer cheques. A cheque deposit leaves
// its installment unpaid; this page is where the cheque is deposited, then
// cleared (installment paid) or bounced / cancelled (deposit rejected).

const STATUSES: PaymentInstrumentStatus[] = [
  'PENDING_CLEARANCE',
  'DEPOSITED',
  'CLEARED',
  'BOUNCED',
  'REPLACED',
  'CANCELLED',
];

const STATUS_CHIP: Record<PaymentInstrumentStatus, string> = {
  PENDING_CLEARANCE: 'bg-amber-500/12 text-amber-600',
  DEPOSITED: 'bg-sky-500/12 text-sky-600',
  CLEARED: 'bg-emerald-500/12 text-emerald-600',
  BOUNCED: 'bg-danger-500/12 text-danger-600',
  REPLACED: 'bg-slate-500/10 text-slate-500',
  CANCELLED: 'bg-slate-500/10 text-slate-500',
};

const STATUS_DOT: Record<PaymentInstrumentStatus, string> = {
  PENDING_CLEARANCE: 'bg-amber-400',
  DEPOSITED: 'bg-sky-400',
  CLEARED: 'bg-emerald-400',
  BOUNCED: 'bg-rose-400',
  REPLACED: 'bg-slate-400',
  CANCELLED: 'bg-slate-400',
};

// The statuses the treasurer works through, shown as cards above the table.
const STRIP: PaymentInstrumentStatus[] = ['PENDING_CLEARANCE', 'DEPOSITED', 'CLEARED', 'BOUNCED'];

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function ChequesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const [session, locale, currency] = await Promise.all([getSession(), getLocale(), getReportsCurrency()]);
  const m = uiT(locale).chequesPage;
  const common = uiT(locale).common;
  const page = Math.max(1, Number(sp.page) || 1);
  const pageSize = 20;
  const status = STATUSES.includes(sp.status as PaymentInstrumentStatus) ? sp.status : undefined;

  const qs = new URLSearchParams({ type: 'CHEQUE', page: String(page), pageSize: String(pageSize) });
  if (status) qs.set('status', status);
  if (sp.dueFrom) qs.set('dueFrom', sp.dueFrom);
  if (sp.dueTo) qs.set('dueTo', sp.dueTo);
  if (sp.q?.trim()) qs.set('q', sp.q.trim());
  // Status counts honour the other filters, so the cards match what a click shows.
  const countQs = (st?: string) => {
    const q = new URLSearchParams(qs);
    q.delete('status');
    q.set('page', '1');
    q.set('pageSize', '1');
    if (st) q.set('status', st);
    return `/payment-instruments?${q}`;
  };
  const [res, allRes, ...stripRes] = await Promise.all([
    safe(api.get<Paged<PaymentInstrument>>(`/payment-instruments?${qs}`)),
    safe(api.get<Paged<PaymentInstrument>>(countQs())),
    ...STRIP.map((st) => safe(api.get<Paged<PaymentInstrument>>(countQs(st)))),
  ]);
  const list = res.data;
  const stripHref = (st?: string) => {
    const q = new URLSearchParams();
    if (st) q.set('status', st);
    if (sp.dueFrom) q.set('dueFrom', sp.dueFrom);
    if (sp.dueTo) q.set('dueTo', sp.dueTo);
    if (sp.q?.trim()) q.set('q', sp.q.trim());
    const s2 = q.toString();
    return `/dashboard/cheques${s2 ? `?${s2}` : ''}`;
  };
  const cards = [
    { key: 'ALL', label: m.statusAll, count: allRes.data?.meta.total, href: stripHref(), active: !status, dot: 'bg-brand-400' },
    ...STRIP.map((st, i) => ({
      key: st,
      label: m.statusLabels[st],
      count: stripRes[i]?.data?.meta.total,
      href: stripHref(st),
      active: status === st,
      dot: STATUS_DOT[st],
    })),
  ];
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <PremiumPageHero
        title={m.title}
        description={m.description}
        breadcrumbs={[
          { label: common.breadcrumbHome, href: '/dashboard' },
          { label: m.breadcrumb },
        ]}
      />

      <PremiumFilterBar method="get" action="/dashboard/cheques">
        <PremiumFilterField label={m.filter.statusLabel} htmlFor="chq-status">
          <Select id="chq-status" name="status" inputSize="sm" defaultValue={status ?? ''} className="w-40 shrink-0">
            <option value="">{m.filter.allStatuses}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{m.statusLabels[s]}</option>
            ))}
          </Select>
        </PremiumFilterField>
        <PremiumFilterField label={m.filter.dueFrom} htmlFor="chq-dueFrom">
          <Input id="chq-dueFrom" name="dueFrom" type="date" inputSize="sm" defaultValue={sp.dueFrom ?? ''} className="w-40 shrink-0" />
        </PremiumFilterField>
        <PremiumFilterField label={m.filter.dueTo} htmlFor="chq-dueTo">
          <Input id="chq-dueTo" name="dueTo" type="date" inputSize="sm" defaultValue={sp.dueTo ?? ''} className="w-40 shrink-0" />
        </PremiumFilterField>
        <div className="flex-1 min-w-[180px]">
          <label htmlFor="chq-q" className="sr-only">{common.searchBtn}</label>
          <Input
            id="chq-q"
            name="q"
            inputSize="sm"
            placeholder={m.filter.searchPlaceholder}
            defaultValue={sp.q ?? ''}
            leftAddon={<Search />}
            className="w-full"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button type="submit" variant="primary" size="sm">{common.filterBtn}</Button>
          <Link href="/dashboard/cheques">
            <Button type="button" variant="secondary" size="sm">{m.filter.resetBtn}</Button>
          </Link>
        </div>
      </PremiumFilterBar>

      <nav data-testid="cheque-status-strip" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <Link
            key={c.key}
            href={c.href as never}
            aria-current={c.active ? 'page' : undefined}
            className={cn(
              'group rounded-2xl border px-4 py-3.5 transition-colors',
              c.active
                ? 'border-brand-500/50 bg-gradient-to-br from-brand-500/[0.14] to-brand-700/[0.04]'
                : 'border-hairline bg-surface hover:border-brand-500/30',
            )}
          >
            <span className="flex items-center gap-2 text-[12px] font-semibold text-slate-500">
              <span className={cn('h-2 w-2 rounded-full', c.dot)} />
              {c.label}
            </span>
            <span className={cn('mt-1.5 block text-[26px] font-bold leading-none tabular-nums', c.active ? 'text-brand-700' : 'text-slate-900')}>
              {c.count ?? '—'}
            </span>
          </Link>
        ))}
      </nav>

      <PremiumSectionCard
        icon={<Landmark />}
        title={list ? m.listTitle(list.meta.total) : m.title}
        padded={false}
      >
        {res.error || !list ? (
          <p className="flex items-center gap-2 px-5 py-6 text-sm text-amber-700">
            <AlertCircle className="h-4 w-4" />
            {m.loadError}
          </p>
        ) : list.data.length === 0 ? (
          <PremiumEmptyState
            icon={<Landmark />}
            title={m.emptyTitle}
            description={m.emptyDesc}
            className="py-12"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]" data-testid="cheques-table">
              <thead className="bg-canvas/40 border-b border-hairline text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
                <tr>
                  <th className="text-start py-3 px-4 whitespace-nowrap">{m.colNumber}</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">{m.colBank}</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">{m.colDueDate}</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">{m.colCustomer}</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">{m.colContract}</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">{m.colAmount}</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">{m.colStatus}</th>
                  <th className="text-end py-3 px-4 whitespace-nowrap">{m.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {list.data.map((pi) => {
                  // One cheque per installment today, so one deposit per cheque.
                  const d = pi.deposits[0];
                  const amount = pi.deposits.reduce((sum, x) => sum + Number(x.amount), 0);
                  return (
                    <tr key={pi.id} className="hover:bg-brand-500/[0.04] transition-colors duration-100">
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-surface-muted px-2 py-1 font-mono text-[12px] font-bold text-slate-700" dir="ltr">
                          <Hash className="h-3 w-3 text-slate-400" />
                          {pi.chequeNumber ?? pi.referenceNumber ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-2 whitespace-nowrap text-slate-700">
                          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-brand-700">
                            <Landmark className="h-3.5 w-3.5" />
                          </span>
                          {pi.drawerBankName ?? pi.bankName ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <p className="tabular-nums text-slate-800">{pi.chequeDueDate ? formatDate(pi.chequeDueDate, locale) : '—'}</p>
                        {pi.status === 'PENDING_CLEARANCE' && pi.chequeDueDate && pi.chequeDueDate.slice(0, 10) <= todayIso && (
                          <p className="text-[11px] font-semibold text-amber-600">{m.dueNow}</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <PersonCell name={d?.contract?.customer?.fullName ?? d?.reservation?.client?.fullName ?? '—'} />
                      </td>
                      <td className="px-4 py-3.5">
                        {d?.contract ? (
                          <CodeCell
                            href={`/dashboard/contracts/${d.contract.id}`}
                            code={d.contract.contractNumber ?? `#${d.contract.id.slice(0, 8).toUpperCase()}`}
                            muted={!d.contract.contractNumber}
                          />
                        ) : d?.reservation ? (
                          // A booking-amount cheque: it pays the reservation.
                          <CodeCell
                            href={`/dashboard/reservations/${d.reservation.id}`}
                            code={d.reservation.reservationNumber ?? `#${d.reservation.id.slice(0, 8).toUpperCase()}`}
                            muted={!d.reservation.reservationNumber}
                          />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap tabular-nums font-bold text-slate-900">
                        {pi.deposits.length > 0 ? formatCurrency(amount, currency, locale) : '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-semibold', STATUS_CHIP[pi.status])}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[pi.status])} />
                          {m.statusLabels[pi.status]}
                        </span>
                        {pi.status === 'BOUNCED' && pi.bounceReason && (
                          <p className="mt-1 max-w-[180px] truncate text-[11px] text-slate-500" title={pi.bounceReason}>{pi.bounceReason}</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-end">
                        <ChequeActions
                          id={pi.id}
                          status={pi.status}
                          canBounce={session?.role === 'ADMIN'}
                          locale={locale}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PremiumSectionCard>

      {list && list.meta.total > pageSize && (
        <Pagination
          basePath="/dashboard/cheques"
          page={page}
          pageSize={pageSize}
          total={list.meta.total}
          params={{ status, dueFrom: sp.dueFrom, dueTo: sp.dueTo, q: sp.q }}
          locale={locale}
        />
      )}
    </div>
  );
}
