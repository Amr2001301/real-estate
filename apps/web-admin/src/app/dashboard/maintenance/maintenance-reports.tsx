import { BarChart3, Users2, ClipboardClock, AlarmClock, Loader2, CheckCircle2 } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { MaintenanceReportSummary } from '@/lib/types';
import { tx } from '@/lib/format';
import { PremiumMetricStrip, PremiumSectionCard } from '@/components/premium';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';

interface Filters {
  status?: string;
  reviewStatus?: string;
  assignedAdminId?: string;
  categoryId?: string;
  from?: string;
  to?: string;
}

/** Fetched once by the page: the KPI strip sits above the filters, the panels below the table. */
export async function loadMaintenanceSummary(filters: Filters) {
  const qs = new URLSearchParams();
  if (filters.status) qs.set('status', filters.status);
  if (filters.reviewStatus) qs.set('reviewStatus', filters.reviewStatus);
  if (filters.assignedAdminId) qs.set('assignedAdminId', filters.assignedAdminId);
  if (filters.categoryId) qs.set('categoryId', filters.categoryId);
  if (filters.from) qs.set('from', filters.from);
  if (filters.to) qs.set('to', filters.to);

  return safe(api.get<MaintenanceReportSummary>(`/maintenance-requests/reports/summary?${qs}`));
}

type SummaryRes = Awaited<ReturnType<typeof loadMaintenanceSummary>>;

export function MaintenanceReports({
  res,
  part,
  locale = 'ar',
}: {
  res: SummaryRes;
  part: 'kpis' | 'panels';
  locale?: Locale;
}) {
  const m = uiT(locale).pages.maintenance.reports;
  if (res.error || !res.data) {
    if (part === 'panels') return null;
    return (
      <div className="rounded-2xl bg-warning-50 border border-warning-100 text-warning-700 px-4 py-2.5 text-xs">
        {m.loadError(res.error ?? 'Unavailable')}
      </div>
    );
  }

  const r = res.data;
  const numFmt = locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US';
  const num = (n: number) => (n === 0 ? '0' : n.toLocaleString(numFmt));
  const maxCategoryCount = r.byCategory[0]?.count ?? 1;
  const maxAssigneeCount = r.byAssignee[0]?.count ?? 1;

  if (part === 'kpis') {
    return (
      <PremiumMetricStrip
        variant="compact"
        cols={4}
        metrics={[
          { label: m.kpiPendingReview, value: num(r.pendingReviewCount), icon: <ClipboardClock />, tone: 'warning' },
          { label: m.kpiOverdue,       value: num(r.overdueCount),       icon: <AlarmClock />,     tone: 'danger'  },
          { label: m.kpiInProgress,    value: num(r.inProgressCount),    icon: <Loader2 />,        tone: 'info'    },
          { label: m.kpiResolved,      value: num(r.resolvedCount),      icon: <CheckCircle2 />,   tone: 'success' },
        ]}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Analytics panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Top requested categories */}
        <PremiumSectionCard
          title={m.sectionCategories}
          icon={<BarChart3 />}
          trailing={
            r.byCategory.length > 0 ? (
              <span className="text-xs text-slate-400 tabular-nums">
                {m.topN(Math.min(5, r.byCategory.length))}
              </span>
            ) : undefined
          }
          padded={false}
        >
          {r.byCategory.length === 0 ? (
            <div className="py-10 flex flex-col items-center gap-2">
              <BarChart3 className="h-8 w-8 text-slate-200" />
              <p className="text-xs text-slate-400">{m.emptyCategories}</p>
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {r.byCategory.slice(0, 5).map((c, i) => (
                <li key={c.categoryId} className="px-5 py-3.5 hover:bg-brand-500/[0.04] transition-colors duration-100">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500/12 text-[10px] font-bold text-brand-700 tabular-nums">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-[13px] font-semibold text-slate-800 truncate">
                      {tx(c.categoryName)}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 bg-surface-muted text-slate-600 text-[11px] font-semibold tabular-nums">
                        {num(c.count)} {m.countSuffix}
                      </span>
                      {c.overdueCount > 0 && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 bg-danger-500/12 text-danger-600 text-[11px] font-semibold tabular-nums">
                          {num(c.overdueCount)} {m.overdueSuffix}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="ms-9 h-1.5 bg-surface-muted rounded-full overflow-hidden" dir="ltr">
                    <div
                      className="h-full bg-gradient-to-l from-brand-400 to-brand-600 rounded-full transition-all duration-500"
                      style={{ width: `${Math.round((c.count / maxCategoryCount) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </PremiumSectionCard>

        {/* Supervisor workload */}
        <PremiumSectionCard
          title={m.sectionSupervisors}
          icon={<Users2 />}
          trailing={
            r.byAssignee.length > 0 ? (
              <span className="text-xs text-slate-400 tabular-nums">{m.supervisorCount(r.byAssignee.length)}</span>
            ) : undefined
          }
          padded={false}
        >
          {r.byAssignee.length === 0 ? (
            <div className="py-10 flex flex-col items-center gap-2">
              <Users2 className="h-8 w-8 text-slate-200" />
              <p className="text-xs text-slate-400">{m.emptyAssignees}</p>
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {r.byAssignee.slice(0, 5).map((a, i) => (
                <li key={a.userId} className="px-5 py-3.5 hover:bg-brand-500/[0.04] transition-colors duration-100">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500/12 text-[10px] font-bold text-brand-700 tabular-nums">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-[13px] font-semibold text-slate-800 truncate">
                      {a.name}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 bg-surface-muted text-slate-600 text-[11px] font-semibold tabular-nums">
                        {num(a.count)} {m.countSuffix}
                      </span>
                      {a.inProgressCount > 0 && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 bg-sky-500/12 text-sky-600 text-[11px] font-semibold tabular-nums">
                          {num(a.inProgressCount)} {m.inProgressSuffix}
                        </span>
                      )}
                      {a.overdueCount > 0 && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 bg-danger-500/12 text-danger-600 text-[11px] font-semibold tabular-nums">
                          {num(a.overdueCount)} {m.overdueSuffix}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="ms-9 h-1.5 bg-surface-muted rounded-full overflow-hidden" dir="ltr">
                    <div
                      className="h-full bg-gradient-to-l from-brand-400 to-brand-600 rounded-full transition-all duration-500"
                      style={{ width: `${Math.round((a.count / maxAssigneeCount) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </PremiumSectionCard>
      </div>
    </div>
  );
}
