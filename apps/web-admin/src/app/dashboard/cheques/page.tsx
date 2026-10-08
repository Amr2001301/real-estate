import Link from 'next/link';
import { AlertCircle, Landmark, Search } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import { getLocale } from '@/lib/locale';
import type { Paged, PaymentInstrument, PaymentInstrumentStatus } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/format';
import { getReportsCurrency } from '@/lib/currency';
import { Badge, type BadgeTone } from '@/components/ui/badge';
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

const STATUS_TONE: Record<PaymentInstrumentStatus, BadgeTone> = {
  PENDING_CLEARANCE: 'warning',
  DEPOSITED: 'info',
  CLEARED: 'success',
  BOUNCED: 'danger',
  REPLACED: 'gray',
  CANCELLED: 'gray',
};

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
  const res = await safe(api.get<Paged<PaymentInstrument>>(`/payment-instruments?${qs}`));
  const list = res.data;

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
                    <tr key={pi.id} className="hover:bg-canvas/40 transition-colors duration-100">
                      <td className="px-4 py-3 font-medium text-slate-800 tabular-nums">
                        {pi.chequeNumber ?? pi.referenceNumber ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{pi.drawerBankName ?? pi.bankName ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{pi.chequeDueDate ? formatDate(pi.chequeDueDate) : '—'}</td>
                      <td className="px-4 py-3 text-slate-800">{d?.contract?.customer?.fullName ?? '—'}</td>
                      <td className="px-4 py-3">
                        {d?.contract ? (
                          <Link href={`/dashboard/contracts/${d.contract.id}`} className="text-brand-600 hover:underline">
                            {d.contract.contractNumber ?? `#${d.contract.id.slice(0, 8)}`}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums font-semibold text-slate-800">
                        {pi.deposits.length > 0 ? formatCurrency(amount, currency) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={STATUS_TONE[pi.status]} size="sm">{m.statusLabels[pi.status]}</Badge>
                        {pi.status === 'BOUNCED' && pi.bounceReason && (
                          <p className="mt-1 text-xs text-slate-500">{pi.bounceReason}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-end">
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
