import Link from 'next/link';
import { Wallet } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { staffOptions } from '@/lib/options';
import { compactParts, formatDate, formatExactCurrency } from '@/lib/format';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
import { getLocale } from '@/lib/locale';
import { getSession } from '@/lib/session';
import { uiT } from '@/messages/ui';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { PremiumPageHero, PremiumMetricStrip, PremiumFilterBar, PremiumFilterField, PremiumEmptyState } from '@/components/premium';
import { dealsT, type SplitsPayload } from '@/components/deals/messages';
import { DealsTabs, Pill } from '../_components/ui';
import { PaySplitButton } from '../_components/pay-button';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * BRK-3 — the team's commission shares. The admin sees everyone's and pays
 * them out; anyone else sees their own («عمولاتي»).
 */
export default async function PayoutsPage({ searchParams }: { searchParams: Promise<{ userId?: string; state?: string }> }) {
  const [sp, locale, currency, session] = await Promise.all([searchParams, getLocale(), getReportsCurrency(), getSession()]);
  const m = dealsT(locale);
  const t = m.payouts;
  const isAdmin = session?.role === 'ADMIN';
  const symbol = currencySymbol(currency, locale);
  const state = sp.state === 'paid' || sp.state === 'unpaid' ? sp.state : undefined;
  const userId = isAdmin && sp.userId && /^[0-9a-f-]{36}$/i.test(sp.userId) ? sp.userId : undefined;
  const qs = new URLSearchParams();
  if (state) qs.set('state', state);
  if (userId) qs.set('userId', userId);
  const [res, staffRes] = await Promise.all([
    safe(api.get<SplitsPayload>(`/deals/splits${qs.size ? `?${qs.toString()}` : ''}`)),
    isAdmin ? safe(staffOptions(['SALES_MANAGER', 'SALES'])) : Promise.resolve(null),
  ]);
  const rows = res.data?.data ?? [];
  const totals = res.data?.totals ?? { payable: 0, awaitingCollection: 0, paid: 0 };
  const compact = (n: number) => compactParts(n, symbol, locale).join(' ');
  const money = (v: number | string) => formatExactCurrency(v, currency, locale);
  const title = isAdmin ? t.title : t.myTitle;
  const filtered = Boolean(state || userId);

  return (
    <div className="flex flex-col gap-6" data-testid="payouts-page">
      <PremiumPageHero
        eyebrow={m.list.title}
        title={title}
        description={isAdmin ? t.desc : t.myDesc}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: m.list.title, href: '/dashboard/deals' },
          { label: title },
        ]}
      >
        <PremiumMetricStrip
          cols={3}
          metrics={[
            { label: t.kpiPayable, value: compact(totals.payable), primary: true },
            { label: t.kpiAwaiting, value: compact(totals.awaitingCollection) },
            { label: t.kpiPaid, value: compact(totals.paid) },
          ]}
        />
      </PremiumPageHero>

      <DealsTabs active="payouts" locale={locale} isAdmin={isAdmin} />

      <PremiumFilterBar
        method="get"
        action="/dashboard/deals/payouts"
        summary={<span className="text-[14px] font-semibold text-slate-700">{t.results(rows.length)}</span>}
        trailing={
          <div className="flex items-center gap-1.5">
            <Button type="submit" variant="primary" size="sm">{m.list.apply}</Button>
            {filtered && (
              <Link href={'/dashboard/deals/payouts' as never}>
                <Button type="button" variant="ghost" size="sm">{m.list.clear}</Button>
              </Link>
            )}
          </div>
        }
      >
        {isAdmin && (
          <PremiumFilterField label={t.person} htmlFor="userId">
            <Select id="userId" name="userId" defaultValue={userId ?? ''}>
              <option value="">{t.anyone}</option>
              {(staffRes?.data?.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
            </Select>
          </PremiumFilterField>
        )}
        <PremiumFilterField label={t.state} htmlFor="state">
          <Select id="state" name="state" defaultValue={state ?? ''}>
            <option value="">{t.anyState}</option>
            <option value="unpaid">{t.unpaid}</option>
            <option value="paid">{t.paid}</option>
          </Select>
        </PremiumFilterField>
      </PremiumFilterBar>

      {res.error && <div role="alert" className="rounded-2xl border border-danger-100 bg-danger-50 p-4 text-sm text-danger-700">{res.error}</div>}

      {rows.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-hairline bg-surface">
          <PremiumEmptyState icon={<Wallet />} title={t.empty} description={t.emptyHint} />
        </div>
      ) : (
        <ul className="divide-y divide-hairline overflow-hidden rounded-[22px] border border-hairline bg-surface" data-testid="payouts-list">
          {rows.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 sm:px-6">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D8B66A]/45 bg-[#D8B66A]/10 font-heading text-[15px] font-bold text-brand-700">
                  {isAdmin ? s.user.fullName.trim().charAt(0) : <span className="num text-[11px]">{Number(s.sharePct)}%</span>}
                </span>
                <div className="min-w-0">
                  {isAdmin ? (
                    <p className="truncate text-[14px] font-bold text-slate-900">
                      {s.user.fullName}
                      <span className="ms-2 text-[12px] font-semibold text-slate-500">
                        {m.role[s.role]} · <span className="num">{Number(s.sharePct)}%</span>
                      </span>
                    </p>
                  ) : (
                    <p className="truncate text-[14px] font-bold text-slate-900">
                      <span className="num">{s.deal.code}</span> · {s.deal.customerName}
                    </p>
                  )}
                  <Link href={`/dashboard/deals/${s.deal.id}` as never} className="mt-0.5 block truncate text-[12.5px] text-slate-500 hover:text-brand-700">
                    {isAdmin ? (
                      <>
                        <span className="num">{s.deal.code}</span> · {s.deal.customerName}
                        {s.deal.listing ? ` · ${s.deal.listing.title}` : ''} · {formatDate(s.deal.closedOn, locale)}
                      </>
                    ) : (
                      <>
                        {m.role[s.role]} · {formatDate(s.deal.closedOn, locale)}
                        {s.deal.listing ? ` · ${s.deal.listing.title}` : ''}
                      </>
                    )}
                  </Link>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-end">
                  <p className="num text-[15px] font-bold text-slate-900">{money(s.amount)}</p>
                  {s.paidAt ? (
                    <Pill tone="green">{m.detail.paidOn(formatDate(s.paidAt, locale))}</Pill>
                  ) : (
                    <Pill tone={s.payable ? 'gold' : 'slate'}>{s.payable ? m.detail.payable : m.detail.awaiting}</Pill>
                  )}
                </div>
                {isAdmin && s.payable && <PaySplitButton dealId={s.deal.id} splitId={s.id} label={m.detail.pay} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
