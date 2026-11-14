import Link from 'next/link';
import { CalendarDays, Rocket } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { compactParts, formatDate, formatExactCurrency } from '@/lib/format';
import { getReportsCurrency, currencySymbol, getCompanyTimeZone, todayIn } from '@/lib/currency';
import { getLocale } from '@/lib/locale';
import { getSession } from '@/lib/session';
import { cn } from '@/lib/cn';
import { uiT } from '@/messages/ui';
import { PremiumPageHero, PremiumMetricStrip, PremiumEmptyState } from '@/components/premium';
import { launchesT, type LaunchRow } from '@/components/launches/messages';
import { Pill } from '@/app/dashboard/deals/_components/ui';
import { LAUNCH_TONE, NewLaunchButton } from './_components/launch-forms';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/** BRK-6 «الإطلاقات» — developers' launches and the EOIs collected for them. */
export default async function LaunchesPage() {
  const [locale, currency, session, timeZone] = await Promise.all([getLocale(), getReportsCurrency(), getSession(), getCompanyTimeZone()]);
  const t = launchesT(locale);
  const canRun = session?.role === 'ADMIN' || session?.role === 'SALES_MANAGER';
  const [res, projectsRes] = await Promise.all([
    safe(api.get<LaunchRow[]>('/launches')),
    canRun ? safe(api.get<Array<{ id: string; name: string; developer: { name: string } }>>('/developers/projects/options')) : Promise.resolve(null),
  ]);
  const rows = res.data ?? [];
  const live = rows.filter((l) => l.status !== 'CLOSED');
  const sum = (f: (l: LaunchRow) => number) => rows.reduce((n, l) => n + f(l), 0);
  const symbol = currencySymbol(currency, locale);
  const addButton = canRun ? <NewLaunchButton locale={locale} projects={projectsRes?.data ?? []} today={todayIn(timeZone)} /> : undefined;

  return (
    <div className="flex flex-col gap-6" data-testid="launches-page">
      <PremiumPageHero
        eyebrow={t.list.eyebrow}
        title={t.list.title}
        description={t.list.desc}
        breadcrumbs={[{ label: uiT(locale).common.breadcrumbHome, href: '/dashboard' }, { label: t.list.title }]}
        actions={addButton}
      >
        <PremiumMetricStrip
          cols={4}
          metrics={[
            { label: t.list.kpiLaunches, value: live.length },
            { label: t.list.kpiEois, value: sum((l) => l.counts.total) },
            { label: t.list.kpiHeld, value: compactParts(sum((l) => l.held), symbol, locale).join(' ') },
            { label: t.list.kpiAllocated, value: sum((l) => l.counts.allocated) },
          ]}
        />
      </PremiumPageHero>

      {res.error && <div role="alert" className="rounded-2xl border border-danger-100 bg-danger-50 p-4 text-sm text-danger-700">{res.error}</div>}

      {rows.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-hairline bg-surface">
          <PremiumEmptyState icon={<Rocket />} title={t.list.empty} description={t.list.emptyHint} action={addButton} />
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3" data-testid="launches-list">
          {rows.map((l) => {
            const filled = l.counts.paid + l.counts.allocated;
            return (
              <li key={l.id}>
                <Link
                  href={`/dashboard/launches/${l.id}` as never}
                  className={cn(
                    'flex h-full flex-col overflow-hidden rounded-[22px] border border-hairline bg-surface transition-all hover:-translate-y-0.5 hover:border-[#D8B66A]/50 hover:shadow-[0_18px_36px_-22px_rgb(10_17_32/0.45)]',
                    l.status === 'CLOSED' && 'opacity-70',
                  )}
                >
                  <div className="bg-navy-band px-5 py-4 text-[#F4ECD8]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[12px] text-[#A9B0BD]">{l.developerName}{l.developerProject ? ` — ${l.developerProject.name}` : ''}</p>
                        <p className="mt-1 truncate font-heading text-[18px] font-bold">{l.name}</p>
                      </div>
                      <Pill tone={LAUNCH_TONE[l.status]}>{t.status[l.status]}</Pill>
                    </div>
                    <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-[#D8B66A]">
                      <CalendarDays className="h-3.5 w-3.5" /> {t.list.launchOn(formatDate(l.launchDate, locale))}
                    </p>
                  </div>
                  <dl className="grid flex-1 grid-cols-3 gap-2 p-5 text-center">
                    {[
                      [t.list.pending, l.counts.pending],
                      [t.list.paid, filled],
                      [t.list.allocated, l.counts.allocated],
                    ].map(([k, v]) => (
                      <div key={String(k)}>
                        <dd className="num font-heading text-[22px] font-bold text-slate-900">{v}</dd>
                        <dt className="text-[11.5px] text-slate-500">{k}</dt>
                      </div>
                    ))}
                  </dl>
                  <p className="num border-t border-hairline px-5 py-3 text-[12.5px] text-slate-500">
                    {t.list.eoiAmount}: <span className="font-bold text-slate-900">{formatExactCurrency(l.eoiAmount, currency, locale)}</span>
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
