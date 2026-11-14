import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Building2, Phone, UserRound, Target, CalendarCheck2, NotebookPen } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { formatDate, formatExactCurrency } from '@/lib/format';
import { getReportsCurrency, getCompanyTimeZone, todayIn } from '@/lib/currency';
import { getLocale } from '@/lib/locale';
import { getSession } from '@/lib/session';
import { uiT } from '@/messages/ui';
import { PremiumPageHero } from '@/components/premium';
import { KindTag } from '@/components/listings/listing-card';
import { listingsT } from '@/components/listings/messages';
import { dealsT, type Deal } from '@/components/deals/messages';
import { DEAL_TONE, Pill } from '../_components/ui';
import { CancelDealButton, ClaimPanel, CoBrokerPanel, MoneyBand, SplitsPanel } from '../_components/deal-panels';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/** BRK-3 — one deal: who bought what, the commission and where it stands. */
export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, locale, session, currency, timeZone] = await Promise.all([params, getLocale(), getSession(), getReportsCurrency(), getCompanyTimeZone()]);
  const m = dealsT(locale);
  const t = m.detail;
  const res = await safe(api.get<Deal>(`/deals/${id}`));
  const d = res.data;
  if (!d) notFound();
  const isAdmin = session?.role === 'ADMIN';
  const canCancel = d.status === 'CLOSED' && (isAdmin || session?.role === 'SALES_MANAGER');
  const phone = d.customerPhone?.replace(/[^\d+]/g, '');

  const facts: Array<{ icon: React.ReactNode; label: string; value: React.ReactNode }> = [
    {
      icon: <UserRound />,
      label: t.customer,
      value: (
        <>
          <span className="block">{d.customerName}</span>
          {phone && (
            <a href={`tel:${phone}`} className="num mt-0.5 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-700 hover:underline" dir="ltr">
              <Phone className="h-3 w-3" /> {d.customerPhone}
            </a>
          )}
        </>
      ),
    },
    {
      icon: <Building2 />,
      label: t.listing,
      value: d.listing ? (
        <Link href={`/dashboard/listings/${d.listing.id}` as never} className="hover:text-brand-700 hover:underline">
          {d.listing.code} · {d.listing.title}
        </Link>
      ) : (
        <span className="font-normal text-slate-500">{m.list.noListing}</span>
      ),
    },
    ...(d.lead
      ? [{
          icon: <Target />,
          label: t.lead,
          value: (
            <Link href={`/dashboard/leads/${d.lead.id}` as never} className="hover:text-brand-700 hover:underline">
              {d.lead.fullName}
            </Link>
          ),
        }]
      : []),
    { icon: <UserRound />, label: t.agent, value: d.agent?.fullName ?? <span className="font-normal text-slate-500">{m.list.noAgent}</span> },
    { icon: <CalendarCheck2 />, label: t.closedOn, value: formatDate(d.closedOn, locale) },
  ];

  return (
    <div className="flex flex-col gap-6" data-testid="deal-page">
      <PremiumPageHero
        eyebrow={`${m.list.eyebrow} · ${d.code}`}
        title={d.customerName}
        description={d.listing ? d.listing.title : listingsT(locale).kind[d.kind]}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: m.list.title, href: '/dashboard/deals' },
          { label: d.code },
        ]}
        meta={
          <>
            <KindTag kind={d.kind} locale={locale} />
            <Pill tone={DEAL_TONE[d.status]}>{m.status[d.status]}</Pill>
            <span className="num text-[12.5px] text-slate-500">
              {m.list.colValue}: <span className="font-bold text-slate-800">{formatExactCurrency(d.dealValue, currency, locale)}</span>
            </span>
          </>
        }
        actions={canCancel ? <CancelDealButton dealId={d.id} locale={locale} /> : undefined}
      />

      {d.status === 'CANCELLED' && (
        <div role="status" className="rounded-2xl border border-hairline bg-slate-500/[0.06] px-5 py-4 text-[13.5px] text-slate-700" data-testid="deal-cancelled">
          <span className="font-bold">{t.cancelled(formatDate(d.cancelledAt!, locale))}</span>
          {d.cancelReason ? ` — ${d.cancelReason}` : ''}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {d.claim && <ClaimPanel deal={d} locale={locale} currency={currency} today={todayIn(timeZone)} canFinance={isAdmin} />}
          {d.coBrokerName && <CoBrokerPanel deal={d} locale={locale} currency={currency} canFinance={isAdmin} />}
          <SplitsPanel deal={d} locale={locale} currency={currency} canFinance={isAdmin} />
        </div>

        <aside className="order-first flex flex-col gap-6 lg:order-none lg:sticky lg:top-6">
          <MoneyBand deal={d} locale={locale} currency={currency} canFinance={isAdmin} />
          <section className="rounded-[22px] border border-hairline bg-surface p-5 sm:p-6">
            <dl className="space-y-4">
              {facts.map((f) => (
                <div key={f.label} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-hairline text-brand-700 [&_svg]:h-4 [&_svg]:w-4">{f.icon}</span>
                  <div className="min-w-0">
                    <dt className="text-[12px] font-semibold text-slate-500">{f.label}</dt>
                    <dd className="mt-0.5 text-[14px] font-bold text-slate-900">{f.value}</dd>
                  </div>
                </div>
              ))}
              {d.notes && (
                <div className="flex items-start gap-3 border-t border-hairline pt-4">
                  <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-hairline text-brand-700"><NotebookPen className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <dt className="text-[12px] font-semibold text-slate-500">{t.notes}</dt>
                    <dd className="mt-0.5 whitespace-pre-line text-[13.5px] text-slate-700">{d.notes}</dd>
                  </div>
                </div>
              )}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
