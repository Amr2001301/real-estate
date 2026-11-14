import Link from 'next/link';
import { Briefcase, Building2, ChevronLeft, ChevronRight, Scale } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getLocale } from '@/lib/locale';
import { getSession } from '@/lib/session';
import { cn } from '@/lib/cn';
import { uiT } from '@/messages/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PremiumPageHero, PremiumMetricStrip, PremiumFilterBar, PremiumFilterField, PremiumEmptyState } from '@/components/premium';
import { developersT, type Developer } from '@/components/developers/messages';
import { Pill } from '@/app/dashboard/deals/_components/ui';
import { AddDeveloperButton } from './_components/forms';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/** BRK-5 «المطوّرون» — the developers the brokerage sells for, with their projects. */
export default async function DevelopersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [sp, locale, session] = await Promise.all([searchParams, getLocale(), getSession()]);
  const t = developersT(locale);
  const q = sp.q?.trim() || undefined;
  const res = await safe(api.get<Developer[]>(`/developers${q ? `?q=${encodeURIComponent(q)}` : ''}`));
  const rows = res.data ?? [];
  const canEdit = session?.role === 'ADMIN' || session?.role === 'SALES_MANAGER';
  const projects = rows.flatMap((d) => d.projects);
  const Chevron = locale === 'ar' ? ChevronLeft : ChevronRight;

  return (
    <div className="flex flex-col gap-6" data-testid="developers-page">
      <PremiumPageHero
        eyebrow={t.list.eyebrow}
        title={t.list.title}
        description={t.list.desc}
        breadcrumbs={[{ label: uiT(locale).common.breadcrumbHome, href: '/dashboard' }, { label: t.list.title }]}
        actions={
          <>
            <Link href={'/dashboard/developers/compare' as never}>
              <Button variant="outline" size="md" leftIcon={<Scale className="h-4 w-4" />}>{t.list.compare}</Button>
            </Link>
            {canEdit && <AddDeveloperButton locale={locale} />}
          </>
        }
      >
        <PremiumMetricStrip
          cols={4}
          metrics={[
            { label: t.list.kpiDevelopers, value: rows.filter((d) => d.active).length },
            { label: t.list.kpiProjects, value: projects.filter((p) => p.active).length },
            { label: t.list.kpiPlans, value: projects.reduce((n, p) => n + (p._count?.plans ?? 0), 0) },
            { label: t.list.kpiListings, value: projects.reduce((n, p) => n + (p._count?.listings ?? 0), 0) },
          ]}
        />
      </PremiumPageHero>

      <PremiumFilterBar method="get" action="/dashboard/developers" trailing={<Button type="submit" variant="primary" size="sm">{t.list.apply}</Button>}>
        <PremiumFilterField label={t.list.searchLabel} htmlFor="q">
          <Input id="q" name="q" defaultValue={q ?? ''} placeholder={t.list.search} />
        </PremiumFilterField>
      </PremiumFilterBar>

      {res.error && <div role="alert" className="rounded-2xl border border-danger-100 bg-danger-50 p-4 text-sm text-danger-700">{res.error}</div>}

      {rows.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-hairline bg-surface">
          <PremiumEmptyState icon={<Briefcase />} title={t.list.empty} description={q ? undefined : t.list.emptyHint} action={canEdit && !q ? <AddDeveloperButton locale={locale} /> : undefined} />
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3" data-testid="developers-list">
          {rows.map((d) => (
            <li key={d.id}>
              <Link
                href={`/dashboard/developers/${d.id}` as never}
                className={cn(
                  'group flex h-full flex-col rounded-[22px] border border-hairline bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-[#D8B66A]/50 hover:shadow-[0_18px_36px_-22px_rgb(10_17_32/0.45)]',
                  !d.active && 'opacity-60',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#D8B66A]/45 bg-[#0E1626] font-heading text-[17px] font-bold text-[#E6C77E]">
                      {d.name.trim().charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-heading text-[17px] font-bold text-slate-900">{d.name}</p>
                      <p className="text-[12px] text-slate-500">{t.list.projects(d.projects.length)}</p>
                    </div>
                  </div>
                  {d.active ? (
                    d.defaultCommissionPct && <Pill tone="gold">{t.list.commission} <span className="num ms-1">{Number(d.defaultCommissionPct)}%</span></Pill>
                  ) : (
                    <Pill tone="slate">{t.list.inactive}</Pill>
                  )}
                </div>
                {d.projects.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {d.projects.slice(0, 4).map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-2 text-[13px]">
                        <span className="flex min-w-0 items-center gap-2 text-slate-700">
                          <Building2 className="h-3.5 w-3.5 shrink-0 text-brand-700" aria-hidden />
                          <span className="truncate">{p.name}</span>
                          {p.city && <span className="truncate text-[12px] text-slate-400">· {p.city}</span>}
                        </span>
                        <span className="num shrink-0 text-[12px] text-slate-500">{t.list.plans(p._count?.plans ?? 0)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <span className="mt-auto inline-flex items-center gap-0.5 pt-4 text-[12.5px] font-bold text-brand-700 opacity-0 transition-opacity group-hover:opacity-100">
                  {t.detail.projects} <Chevron className="h-3.5 w-3.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
