import { notFound } from 'next/navigation';
import { CalendarDays, ListOrdered } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { compactParts, formatDate, formatExactCurrency } from '@/lib/format';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
import { getLocale } from '@/lib/locale';
import { getSession } from '@/lib/session';
import { uiT } from '@/messages/ui';
import { PremiumPageHero, PremiumMetricStrip } from '@/components/premium';
import { launchesT, type LaunchDetail } from '@/components/launches/messages';
import { Panel, Pill } from '@/app/dashboard/deals/_components/ui';
import { EoiRow, LAUNCH_TONE, LaunchStatusSwitch, NewEoiForm } from '../_components/launch-forms';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/** BRK-6 — one launch: its EOI queue; reps add EOIs, managers take payments and allocate. */
export default async function LaunchPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, locale, currency, session] = await Promise.all([params, getLocale(), getReportsCurrency(), getSession()]);
  const t = launchesT(locale);
  const res = await safe(api.get<LaunchDetail>(`/launches/${id}`));
  const l = res.data;
  if (!l) notFound();
  const canRun = session?.role === 'ADMIN' || session?.role === 'SALES_MANAGER';
  const symbol = currencySymbol(currency, locale);
  const count = (s: string[]) => l.eois.filter((e) => s.includes(e.status)).length;
  const held = l.eois.filter((e) => e.status === 'PAID' || e.status === 'ALLOCATED').reduce((n, e) => n + Number(e.amount), 0);
  const eois = [...l.eois].sort((a, b) => (a.queue ?? 9999) - (b.queue ?? 9999));

  return (
    <div className="flex flex-col gap-6" data-testid="launch-page">
      <PremiumPageHero
        eyebrow={`${l.developerName}${l.developerProject ? ` — ${l.developerProject.name}` : ''}`}
        title={l.name}
        description={l.notes ?? undefined}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: t.list.title, href: '/dashboard/launches' },
          { label: l.name },
        ]}
        meta={
          <>
            <Pill tone={LAUNCH_TONE[l.status]}>{t.status[l.status]}</Pill>
            <span className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-500">
              <CalendarDays className="h-3.5 w-3.5" /> {t.list.launchOn(formatDate(l.launchDate, locale))}
            </span>
            <span className="num text-[12.5px] text-slate-500">
              {t.list.eoiAmount}: <span className="font-bold text-slate-800">{formatExactCurrency(l.eoiAmount, currency, locale)}</span>
            </span>
          </>
        }
        actions={canRun ? <LaunchStatusSwitch id={l.id} status={l.status} locale={locale} /> : undefined}
      >
        <PremiumMetricStrip
          cols={4}
          metrics={[
            { label: t.detail.queue, value: l.queueLength },
            { label: t.list.pending, value: count(['PENDING_PAYMENT']) },
            { label: t.list.allocated, value: count(['ALLOCATED']) },
            { label: t.detail.held, value: compactParts(held, symbol, locale).join(' ') },
          ]}
        />
      </PremiumPageHero>

      <Panel
        icon={<ListOrdered />}
        title={canRun ? t.detail.allEois : t.detail.yourEois}
        sub={t.detail.queueSub}
        action={l.status !== 'CLOSED' ? <NewEoiForm locale={locale} launchId={l.id} /> : undefined}
        testId="launch-eois"
      >
        {eois.length === 0 ? (
          <p className="text-[13.5px] text-slate-500">{t.detail.empty}</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {eois.map((e) => (
              <EoiRow key={e.id} eoi={e} locale={locale} currency={currency} canRun={canRun} canCancel />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
