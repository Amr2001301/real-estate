import Link from 'next/link';
import { ChevronLeft, ChevronRight, Target } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { compactParts } from '@/lib/format';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
import { getLocale } from '@/lib/locale';
import { getSession } from '@/lib/session';
import { uiT } from '@/messages/ui';
import { PremiumPageHero, PremiumMetricStrip, PremiumEmptyState } from '@/components/premium';
import { dealsT, type TargetsPayload } from '@/components/deals/messages';
import { DealsTabs } from '../_components/ui';
import { TargetCard } from '../_components/target-card';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
function shift(period: string, n: number) {
  const [y, m] = period.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/**
 * BRK-4 — the month's targets: the admin sets them and pays the bonuses, a
 * manager follows the team, a rep their own («هدفي»).
 */
export default async function TargetsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const [sp, locale, currency, session] = await Promise.all([searchParams, getLocale(), getReportsCurrency(), getSession()]);
  const m = dealsT(locale);
  const t = m.targets;
  const isAdmin = session?.role === 'ADMIN';
  const symbol = currencySymbol(currency, locale);
  const res = await safe(api.get<TargetsPayload>(`/deals/targets${sp.period && PERIOD.test(sp.period) ? `?period=${sp.period}` : ''}`));
  const data = res.data;
  const period = data?.period ?? sp.period ?? '';
  const rows = data?.rows ?? [];
  const totals = data?.totals ?? { commissionTarget: 0, commission: 0, achieved: 0, withTarget: 0 };
  const compact = (n: number) => compactParts(n, symbol, locale).join(' ');
  const own = !isAdmin && session?.role === 'SALES';
  const title = own ? t.myTitle : t.title;
  const monthName = period
    ? new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${period}-01T00:00:00Z`))
    : '';
  const [Back, Fwd] = locale === 'ar' ? [ChevronRight, ChevronLeft] : [ChevronLeft, ChevronRight];
  const pct = totals.commissionTarget > 0 ? Math.round((totals.commission / totals.commissionTarget) * 100) : 0;

  return (
    <div className="flex flex-col gap-6" data-testid="targets-page">
      <PremiumPageHero
        eyebrow={m.list.title}
        title={title}
        description={own ? t.myDesc : t.desc}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: m.list.title, href: '/dashboard/deals' },
          { label: title },
        ]}
        actions={
          period ? (
            <div className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface p-1">
              <Link href={`/dashboard/deals/targets?period=${shift(period, -1)}` as never} aria-label={t.prev} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-surface-muted hover:text-slate-900">
                <Back className="h-4 w-4" />
              </Link>
              <span className="min-w-[8.5rem] px-2 text-center text-[13.5px] font-bold text-slate-900" data-testid="targets-month">{monthName}</span>
              <Link href={`/dashboard/deals/targets?period=${shift(period, 1)}` as never} aria-label={t.next} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-surface-muted hover:text-slate-900">
                <Fwd className="h-4 w-4" />
              </Link>
            </div>
          ) : undefined
        }
      >
        <PremiumMetricStrip
          cols={3}
          metrics={[
            { label: t.kpiTarget, value: compact(totals.commissionTarget) },
            { label: t.kpiActual, value: compact(totals.commission), sub: t.ofTarget(pct) },
            own && rows[0]?.target
              ? { label: t.bonusAmount, value: compact(Number(rows[0].target.bonusAmount)), sub: t.bonus[rows[0].bonus] }
              : { label: t.kpiAchieved, value: totals.achieved, sub: t.kpiAchievedSub(totals.withTarget) },
          ]}
        />
      </PremiumPageHero>

      <DealsTabs active="targets" locale={locale} isAdmin={isAdmin} />

      {res.error && <div role="alert" className="rounded-2xl border border-danger-100 bg-danger-50 p-4 text-sm text-danger-700">{res.error}</div>}

      {rows.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-hairline bg-surface">
          <PremiumEmptyState icon={<Target />} title={t.empty} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <TargetCard key={`${r.user.id}-${period}`} row={r} period={period} locale={locale} currency={currency} canEdit={isAdmin} />
          ))}
        </div>
      )}
    </div>
  );
}
