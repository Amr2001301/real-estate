import { BarChart3, Users2, ClipboardClock, AlarmClock, Loader2, CheckCircle2 } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { MaintenanceReportSummary } from '@/lib/types';
import { tx } from '@/lib/format';
import { PremiumMetricStrip, PremiumSectionCard } from '@/components/premium';

interface Filters {
  status?: string;
  reviewStatus?: string;
  assignedAdminId?: string;
  categoryId?: string;
  from?: string;
  to?: string;
}

export async function MaintenanceReports({ filters }: { filters: Filters }) {
  const qs = new URLSearchParams();
  if (filters.status) qs.set('status', filters.status);
  if (filters.reviewStatus) qs.set('reviewStatus', filters.reviewStatus);
  if (filters.assignedAdminId) qs.set('assignedAdminId', filters.assignedAdminId);
  if (filters.categoryId) qs.set('categoryId', filters.categoryId);
  if (filters.from) qs.set('from', filters.from);
  if (filters.to) qs.set('to', filters.to);

  const res = await safe(api.get<MaintenanceReportSummary>(`/maintenance-requests/reports/summary?${qs}`));
  if (res.error || !res.data) {
    return (
      <div className="rounded-2xl bg-warning-50 border border-warning-100 text-warning-700 px-4 py-2.5 text-xs">
        تعذّر تحميل تقرير الصيانة: {res.error ?? 'غير متاح'}
      </div>
    );
  }

  const r = res.data;
  const num = (n: number) => (n === 0 ? '0' : n.toLocaleString('ar-EG'));
  const maxCategoryCount = r.byCategory[0]?.count ?? 1;
  const maxAssigneeCount = r.byAssignee[0]?.count ?? 1;

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <PremiumMetricStrip
        variant="compact"
        cols={4}
        metrics={[
          { label: 'قيد المراجعة', value: num(r.pendingReviewCount), icon: <ClipboardClock />, tone: 'warning' },
          { label: 'متأخرة',       value: num(r.overdueCount),       icon: <AlarmClock />,     tone: 'danger'  },
          { label: 'قيد التنفيذ',  value: num(r.inProgressCount),    icon: <Loader2 />,        tone: 'info'    },
          { label: 'تم الإنجاز',   value: num(r.resolvedCount),      icon: <CheckCircle2 />,   tone: 'success' },
        ]}
      />

      {/* Analytics panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Top requested categories */}
        <PremiumSectionCard
          title="التصنيفات الأكثر طلباً"
          icon={<BarChart3 />}
          trailing={
            r.byCategory.length > 0 ? (
              <span className="text-xs text-slate-400 tabular-nums">
                أعلى {Math.min(5, r.byCategory.length)}
              </span>
            ) : undefined
          }
          padded={false}
        >
          {r.byCategory.length === 0 ? (
            <div className="py-10 flex flex-col items-center gap-2">
              <BarChart3 className="h-8 w-8 text-slate-200" />
              <p className="text-xs text-slate-400">لا توجد بيانات</p>
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {r.byCategory.slice(0, 5).map((c, i) => (
                <li key={c.categoryId} className="px-5 py-3.5 hover:bg-canvas/40 transition-colors duration-100">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 border border-brand-100 text-[10px] font-bold text-brand-600 tabular-nums">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-[13px] font-semibold text-slate-800 truncate">
                      {tx(c.categoryName)}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 bg-canvas border border-hairline text-slate-600 text-[11px] font-semibold tabular-nums">
                        {num(c.count)} طلب
                      </span>
                      {c.overdueCount > 0 && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 bg-danger-50 text-danger-600 text-[11px] font-semibold tabular-nums">
                          {num(c.overdueCount)} متأخر
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="ms-9 h-1 bg-slate-100 rounded-full overflow-hidden" dir="ltr">
                    <div
                      className="h-full bg-brand-400 rounded-full transition-all duration-500"
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
          title="الأعباء على مشرفي الصيانة"
          icon={<Users2 />}
          trailing={
            r.byAssignee.length > 0 ? (
              <span className="text-xs text-slate-400 tabular-nums">{r.byAssignee.length} مشرف</span>
            ) : undefined
          }
          padded={false}
        >
          {r.byAssignee.length === 0 ? (
            <div className="py-10 flex flex-col items-center gap-2">
              <Users2 className="h-8 w-8 text-slate-200" />
              <p className="text-xs text-slate-400">لا توجد طلبات مُسندة</p>
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {r.byAssignee.slice(0, 5).map((a, i) => (
                <li key={a.userId} className="px-5 py-3.5 hover:bg-canvas/40 transition-colors duration-100">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 border border-brand-100 text-[10px] font-bold text-brand-600 tabular-nums">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-[13px] font-semibold text-slate-800 truncate">
                      {a.name}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 bg-canvas border border-hairline text-slate-600 text-[11px] font-semibold tabular-nums">
                        {num(a.count)} طلب
                      </span>
                      {a.inProgressCount > 0 && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 bg-info-50 text-info-600 text-[11px] font-semibold tabular-nums">
                          {num(a.inProgressCount)} جارٍ
                        </span>
                      )}
                      {a.overdueCount > 0 && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 bg-danger-50 text-danger-600 text-[11px] font-semibold tabular-nums">
                          {num(a.overdueCount)} متأخر
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="ms-9 h-1 bg-slate-100 rounded-full overflow-hidden" dir="ltr">
                    <div
                      className="h-full bg-brand-400 rounded-full transition-all duration-500"
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
