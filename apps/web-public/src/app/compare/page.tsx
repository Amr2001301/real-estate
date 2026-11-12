import Link from 'next/link';
import type { Route } from 'next';
import { Plus } from 'lucide-react';
import { notFound } from 'next/navigation';
import { pageMeta } from '@/lib/page-meta';
import { fetchBranding } from '@/lib/branding';
import { apiFetch } from '@/lib/api-server';
import type { Paginated, PublicPaymentPlan, PublicUnit } from '@/lib/api-types';
import { routes } from '@/lib/routes';
import { getLocale } from '@/lib/locale';
import { getResolvedTenant } from '@/lib/tenant';
import { formatNumber } from '@/lib/format';
import { siteT } from '@/messages/site';
import { extraT } from '@/messages/site-extra';
import { Container } from '@/components/ui/Container';
import { ListHero } from '@/components/layout/ListHero';
import { ContactCta } from '@/components/marketing/ContactCta';
import { ErrorState } from '@/components/states/ErrorState';
import { InlineNotice } from '@/components/states/InlineNotice';
import { CompareView, type CompareTerms } from '@/components/compare/CompareView';
import { DetailHead } from '@/components/detail/DetailStats';
import { UnitCard } from '@/components/home/UnitCard';

const MAX = 3;
const REVALIDATE = 60;

export async function generateMetadata() {
  return pageMeta('compare', { robots: { index: false, follow: true } });
}

type SearchParams = Promise<{ ids?: string | string[] }>;

function parseIds(raw: string | string[] | undefined): string[] {
  const joined = Array.isArray(raw) ? raw.join(',') : (raw ?? '');
  const seen = new Set<string>();
  for (const part of joined.split(',')) {
    const id = part.trim();
    if (id) seen.add(id);
  }
  return [...seen].slice(0, MAX);
}

/** The lowest down payment and its smallest monthly instalment among a unit's public instalment plans. */
function termsOf(plans: PublicPaymentPlan[]): CompareTerms {
  const inst = plans.filter((p) => !p.isCash && p.downPaymentPercent > 0).sort((a, b) => a.downPaymentPercent - b.downPaymentPercent);
  const p = inst[0];
  if (!p) return null;
  const lowest = p.options.reduce<(typeof p.options)[number] | null>((a, o) => (a === null || o.installmentAmount < a.installmentAmount ? o : a), null);
  const balloon = lowest?.balloonAmount && lowest.balloonEveryMonths ? { amount: lowest.balloonAmount, everyMonths: lowest.balloonEveryMonths } : null;
  return { downPercent: p.downPaymentPercent, downAmount: p.downPaymentAmount, monthly: lowest?.installmentAmount ?? 0, balloon };
}

export default async function ComparePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const ids = parseIds(sp.ids);
  // Only this site's company's units: without a tenant the API would fall
  // back to the default company.
  const tenant = await getResolvedTenant();
  if (!tenant) notFound();
  const opts = { revalidate: REVALIDATE, tenantSlug: tenant.slug };

  const [results, plans, locale, branding] = await Promise.all([
    Promise.all(ids.map((id) => apiFetch<PublicUnit>(`/public/units/${id}`, opts))),
    Promise.all(ids.map((id) => apiFetch<PublicPaymentPlan[]>(`/public/units/${id}/payment-plans`, opts))),
    getLocale(),
    fetchBranding(tenant.slug),
  ]);
  const m = siteT(locale);
  const t = extraT(locale).comparePage;
  const units = results.flatMap((r) => (r.ok ? [r.data] : []));
  const terms: Record<string, CompareTerms> = {};
  ids.forEach((id, i) => {
    const r = plans[i];
    terms[id] = r?.ok && Array.isArray(r.data) ? termsOf(r.data) : null;
  });
  const failedCount = ids.length - units.length;

  // With nothing chosen yet, a few units to start from.
  const suggested =
    ids.length === 0
      ? await apiFetch<Paginated<PublicUnit>>(`/public/units?pageSize=3`, opts).then((r) => (r.ok ? r.data.data.slice(0, 3) : []))
      : [];

  return (
    <>
      <ListHero homeLabel={m.unitDetail.breadHome} title={m.compare.title} subtitle={m.compare.subtitle} />

      <section className="relative z-10 -mt-16 pb-20 sm:-mt-20">
        <Container>
          {ids.length === 0 ? (
            <div className="rounded-[1.75rem] border border-hairline bg-surface p-6 shadow-[0_30px_70px_-40px_rgba(0,0,0,0.4)] sm:p-10">
              <div className="grid gap-4 sm:grid-cols-3">
                {[1, 2, 3].map((n) => (
                  <Link
                    key={n}
                    href={routes.units}
                    className="group flex h-44 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-hairline text-ink-muted transition-colors hover:border-gold-400/60 hover:text-ink-strong"
                  >
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gold-400/15 text-gold-700 dark:text-gold-300">
                      <Plus className="h-6 w-6" aria-hidden />
                    </span>
                    <span className="text-[15px] font-semibold">{t.slot(formatNumber(n, locale))}</span>
                  </Link>
                ))}
              </div>
              <div className="mt-9 flex flex-col gap-8 border-t border-hairline pt-8 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="font-display text-[1.6rem] font-semibold text-ink-strong">{m.compare.emptyTitle}</h2>
                  <ol className="mt-4 grid gap-3 sm:grid-cols-3 sm:gap-6">
                    {t.steps.map((s, i) => (
                      <li key={s} className="flex items-start gap-3 text-[15px] text-ink-muted">
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy font-display text-sm font-semibold text-white">
                          {formatNumber(i + 1, locale)}
                        </span>
                        {s}
                      </li>
                    ))}
                  </ol>
                </div>
                <Link
                  href={routes.units}
                  className="inline-flex h-12 shrink-0 items-center justify-center rounded-2xl bg-gold-400 px-7 text-[15px] font-semibold text-[#1B1206] transition-colors hover:bg-gold-300"
                >
                  {m.compare.browseUnits} ←
                </Link>
              </div>
            </div>
          ) : units.length === 0 ? (
            <div className="rounded-[1.75rem] border border-hairline bg-surface p-10">
              <ErrorState title={m.compare.errorTitle} message={m.compare.errorMsg} className="mx-auto max-w-2xl" />
            </div>
          ) : (
            <>
              {failedCount > 0 && (
                <div className="mb-6">
                  <InlineNotice tone="warning">{m.compare.partialWarning}</InlineNotice>
                </div>
              )}
              <CompareView units={units} terms={terms} />
              <div className="mt-6 flex justify-end">
                <Link href={routes.units as Route} className="text-[15px] font-semibold text-ink-muted transition-colors hover:text-ink-strong">
                  {extraT(locale).compare.backToUnits} ←
                </Link>
              </div>
            </>
          )}

          {suggested.length > 0 && (
            <div className="mt-16">
              <DetailHead eyebrow={m.compare.eyebrow} title={t.suggested} />
              <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
                {suggested.map((u) => (
                  <UnitCard key={u.id} unit={u} locale={locale} />
                ))}
              </div>
            </div>
          )}
        </Container>
      </section>

      <ContactCta locale={locale} branding={branding} image={units[0]?.coverImage ?? suggested[0]?.coverImage ?? null} />
    </>
  );
}
