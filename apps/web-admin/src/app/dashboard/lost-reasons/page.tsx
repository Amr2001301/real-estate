import Link from 'next/link';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { LeadSource, LostReason, LostReport, Translatable } from '@/lib/types';
import { formatDate, tx } from '@/lib/format';
import { getLocale } from '@/lib/locale';
import { getSession } from '@/lib/session';
import { can } from '@/lib/permissions';
import { getCompanyTimeZone, todayIn } from '@/lib/currency';
import { projectOptions, staffOptions } from '@/lib/options';
import { uiT } from '@/messages/ui';
import { PremiumBars, PremiumMetricStrip, PremiumPageHero, PremiumPanel } from '@/components/premium';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { lostT } from '@/components/crm/lost-messages';
import { LostReasonsManager } from './_components/lost-reasons-manager';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  tab?: string;
  from?: string;
  to?: string;
  salesId?: string;
  projectId?: string;
  sourceId?: string;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A horizontal bar row: label, count and share of all losses. */
function ShareRow({ label, count, share, href, muted }: { label: string; count: number; share: number; href?: string; muted?: boolean }) {
  const body = (
    <>
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className={cn('truncate font-semibold', muted ? 'text-slate-500' : 'text-slate-800')}>{label}</span>
        <span className="shrink-0 tabular-nums text-slate-500">
          <span className="font-semibold text-slate-900">{count}</span> · {share}%
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-muted">
        <div className={cn('h-full rounded-full', muted ? 'bg-slate-300' : 'bg-gradient-to-l from-danger-500 to-rose-400')} style={{ width: `${Math.max(share, 2)}%` }} />
      </div>
    </>
  );
  return href ? (
    <Link href={href as never} className="block rounded-xl px-2 py-1.5 -mx-2 hover:bg-surface-muted/60">{body}</Link>
  ) : (
    <div className="py-1.5">{body}</div>
  );
}

/** «أسباب الخسارة» — the report, and (for the admin) the list the team picks from. */
export default async function LostReasonsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [sp, locale, session, zone] = await Promise.all([searchParams, getLocale(), getSession(), getCompanyTimeZone()]);
  const t = lostT(locale);
  const m = t.page;
  // The report is the managers' (by role); the reasons list opens to whoever
  // holds lead_sources:manage (PRM).
  const canReport = session?.role === 'ADMIN' || session?.role === 'SALES_MANAGER';
  const canManage = session?.role === 'ADMIN' || (await can('lead_sources:manage'));
  const tab = (sp.tab === 'reasons' && canManage) || !canReport ? 'reasons' : 'report';

  const today = todayIn(zone);
  const [y, mo] = today.split('-').map(Number) as [number, number];
  const ymd = (yy: number, mm: number, dd: number) => new Date(Date.UTC(yy, mm - 1, dd)).toISOString().slice(0, 10);
  const presets = [
    { key: 'month' as const, from: ymd(y, mo, 1), to: today },
    { key: 'quarter' as const, from: ymd(y, mo - 2, 1), to: today },
    { key: 'year' as const, from: ymd(y, 1, 1), to: today },
    { key: 'all' as const, from: '', to: '' },
  ];
  const from = sp.from && DAY.test(sp.from) ? sp.from : '';
  const to = sp.to && DAY.test(sp.to) ? sp.to : '';

  const filters = new URLSearchParams();
  if (from) filters.set('from', from);
  if (to) filters.set('to', to);
  for (const k of ['salesId', 'projectId', 'sourceId'] as const) if (sp[k]) filters.set(k, sp[k]!);
  const hrefWith = (over: Record<string, string>) => {
    const p = new URLSearchParams(filters);
    for (const [k, v] of Object.entries(over)) (v ? p.set(k, v) : p.delete(k));
    const s = p.toString();
    return `/dashboard/lost-reasons${s ? `?${s}` : ''}`;
  };

  const [reportRes, repsRes, projectsRes, sourcesRes, reasonsRes] = await Promise.all([
    tab === 'report' ? safe(api.get<LostReport>(`/leads/lost-report?${filters.toString()}`)) : Promise.resolve({ data: null, error: null }),
    safe(staffOptions(['SALES', 'SALES_MANAGER'])),
    safe(projectOptions()),
    safe(api.get<LeadSource[]>('/lead-sources')),
    tab === 'reasons' ? safe(api.get<LostReason[]>('/lost-reasons?all=1')) : Promise.resolve({ data: null, error: null }),
  ]);
  const r = reportRes.data;
  const name = (v: Translatable | null, fallback: string) => (v ? tx(v, locale) : fallback);
  const top = r?.byReason.find((x) => x.reasonId !== null);
  const monthLabel = (key: string) =>
    new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'ar-EG', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(`${key}-01T00:00:00Z`));

  const selectCls =
    'h-9 rounded-xl border border-hairline bg-surface px-3 text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30';

  return (
    <div className="space-y-6">
      <PremiumPageHero
        eyebrow={m.eyebrow}
        title={m.title}
        description={m.desc}
        breadcrumbs={[{ label: uiT(locale).common.breadcrumbHome, href: '/dashboard' }, { label: m.title }]}
      >
        {tab === 'report' && r && (
          <PremiumMetricStrip
            cols={4}
            metrics={[
              { label: m.kpi.lost, value: r.totals.lost },
              { label: m.kpi.lossRate, value: r.totals.lossRate ?? '—', unit: r.totals.lossRate !== null ? '%' : '', sub: `${m.kpi.lossRateSub} · ${m.kpi.won} ${r.totals.won}` },
              { label: m.kpi.top, value: top ? name(top.name, m.noReason) : '—', sub: top ? `${top.count} · ${top.share}%` : undefined },
              { label: m.kpi.unrecorded, value: r.totals.unrecorded, sub: m.kpi.unrecordedSub },
            ]}
          />
        )}
      </PremiumPageHero>

      {canManage && canReport && (
        <nav role="tablist" className="flex gap-2 border-b border-hairline">
          {(['report', 'reasons'] as const).map((k) => (
            <Link
              key={k}
              role="tab"
              aria-selected={tab === k}
              data-testid={`lost-tab-${k}`}
              href={(k === 'report' ? '/dashboard/lost-reasons' : '/dashboard/lost-reasons?tab=reasons') as never}
              className={cn(
                '-mb-px border-b-2 px-4 py-2.5 text-[13.5px] font-semibold',
                tab === k ? 'border-brand-500 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800',
              )}
            >
              {m.tabs[k]}
            </Link>
          ))}
        </nav>
      )}

      {tab === 'reasons' ? (
        <LostReasonsManager locale={locale} reasons={reasonsRes.data ?? []} />
      ) : (
        <>
          {/* Filters */}
          <div className="rounded-[20px] border border-hairline bg-surface p-4">
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => {
                const on = p.from === from && p.to === to;
                return (
                  <Link
                    key={p.key}
                    href={hrefWith({ from: p.from, to: p.to }) as never}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-[12.5px] font-semibold',
                      on ? 'border-brand-500 bg-brand-500/12 text-brand-700' : 'border-hairline text-slate-600 hover:border-brand-500/40',
                    )}
                  >
                    {m.presets[p.key]}
                  </Link>
                );
              })}
            </div>
            <form method="get" className="mt-3 flex flex-wrap items-end gap-3">
              <label className="text-[12px] font-semibold text-slate-500">
                {m.filters.from}
                <input type="date" name="from" defaultValue={from} className={cn(selectCls, 'mt-1 block')} />
              </label>
              <label className="text-[12px] font-semibold text-slate-500">
                {m.filters.to}
                <input type="date" name="to" defaultValue={to} className={cn(selectCls, 'mt-1 block')} />
              </label>
              <label className="text-[12px] font-semibold text-slate-500">
                {m.filters.sales}
                <select name="salesId" defaultValue={sp.salesId ?? ''} className={cn(selectCls, 'mt-1 block')}>
                  <option value="">{m.filters.all}</option>
                  {(repsRes.data?.data ?? []).map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                </select>
              </label>
              <label className="text-[12px] font-semibold text-slate-500">
                {m.filters.project}
                <select name="projectId" defaultValue={sp.projectId ?? ''} className={cn(selectCls, 'mt-1 block')}>
                  <option value="">{m.filters.all}</option>
                  {(projectsRes.data?.data ?? []).map((p) => <option key={p.id} value={p.id}>{tx(p.name, locale)}</option>)}
                </select>
              </label>
              <label className="text-[12px] font-semibold text-slate-500">
                {m.filters.source}
                <select name="sourceId" defaultValue={sp.sourceId ?? ''} className={cn(selectCls, 'mt-1 block')}>
                  <option value="">{m.filters.all}</option>
                  {(sourcesRes.data ?? []).map((s) => <option key={s.id} value={s.id}>{tx(s.name, locale)}</option>)}
                </select>
              </label>
              <Button type="submit" variant="primary" size="sm">{m.filters.apply}</Button>
              <Link href={'/dashboard/lost-reasons' as never} className="pb-2 text-[12.5px] font-semibold text-slate-500 hover:text-slate-800">
                {m.filters.reset}
              </Link>
            </form>
          </div>

          {reportRes.error ? (
            <div role="alert" className="rounded-[20px] bg-danger-500/10 p-6 text-sm text-danger-600">{m.error}: {reportRes.error}</div>
          ) : !r || r.totals.lost === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-[22px] border border-dashed border-hairline bg-surface px-6 py-14 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <p className="font-heading text-[16px] font-semibold text-slate-800">{m.empty}</p>
            </div>
          ) : (
            <div data-testid="lost-report" className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <PremiumPanel title={m.byReason} sub={m.byReasonSub}>
                <div className="space-y-1">
                  {r.byReason.map((x) => (
                    <ShareRow
                      key={x.reasonId ?? 'none'}
                      label={`${name(x.name, m.noReason)}${x.active ? '' : ` (${m.off})`}`}
                      count={x.count}
                      share={x.share}
                      muted={x.reasonId === null}
                      href={`/dashboard/leads?lostReasonId=${x.reasonId ?? 'none'}`}
                    />
                  ))}
                </div>
              </PremiumPanel>

              <PremiumPanel title={m.bySales} sub={m.bySalesSub}>
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-start text-[11.5px] text-slate-400">
                      <th className="pb-2 text-start font-semibold">{m.cols.owner}</th>
                      <th className="pb-2 text-start font-semibold">{m.cols.count}</th>
                      <th className="pb-2 text-start font-semibold">{m.cols.top}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {r.bySales.map((x) => (
                      <tr key={x.salesId ?? 'none'}>
                        <td className="py-2 font-semibold text-slate-800">{x.fullName ?? m.unassigned}</td>
                        <td className="py-2 tabular-nums text-slate-700">{x.count} <span className="text-slate-400">· {x.share}%</span></td>
                        <td className="py-2 text-slate-600">
                          {name(x.topReason.name, m.noReason)} <span className="tabular-nums text-slate-400">({x.topReason.count})</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </PremiumPanel>

              <PremiumPanel title={m.trend}>
                <PremiumBars
                  data={r.trend.slice(-12).map((x) => ({ label: monthLabel(x.month), value: x.count }))}
                  height={200}
                />
              </PremiumPanel>

              <PremiumPanel title={m.bySource}>
                <div className="space-y-1">
                  {r.bySource.map((x) => (
                    <ShareRow key={x.sourceId ?? 'none'} label={name(x.name, m.noSource)} count={x.count} share={x.share} muted={!x.sourceId} />
                  ))}
                </div>
              </PremiumPanel>

              <PremiumPanel title={m.byProject}>
                <div className="space-y-1">
                  {r.byProject.map((x) => (
                    <ShareRow key={x.projectId ?? 'none'} label={name(x.name, m.noProject)} count={x.count} share={x.share} muted={!x.projectId} />
                  ))}
                </div>
              </PremiumPanel>

              <PremiumPanel title={m.recent}>
                <ul className="divide-y divide-hairline">
                  {r.recent.map((l) => (
                    <li key={l.id} className="flex items-start gap-3 py-2.5 text-[13px]">
                      <div className="min-w-0 flex-1">
                        <Link href={`/dashboard/leads/${l.id}` as never} className="font-semibold text-slate-900 hover:text-brand-700">{l.fullName}</Link>
                        <p className="text-[12px] text-slate-500">
                          <span className="font-semibold text-danger-600">{name(l.lostReason?.name ?? null, m.noReason)}</span>
                          {l.assignedSales && <> · {l.assignedSales.fullName}</>}
                          {l.projectInterest && <> · {tx(l.projectInterest.name, locale)}</>}
                        </p>
                        {l.lostNote && <p className="mt-0.5 line-clamp-1 text-[12px] text-slate-500">{l.lostNote}</p>}
                      </div>
                      <span className="shrink-0 tabular-nums text-[12px] text-slate-400">{formatDate(l.lostAt, locale, zone)}</span>
                      <Link href={`/dashboard/leads/${l.id}` as never} aria-label={m.cols.lead} className="text-slate-400 hover:text-brand-700">
                        <ArrowLeft className="h-4 w-4 rtl:rotate-0 ltr:rotate-180" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </PremiumPanel>
            </div>
          )}
        </>
      )}
    </div>
  );
}
