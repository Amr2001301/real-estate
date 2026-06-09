import { BarChart3, Users2, ClipboardClock, AlarmClock, Loader2, CheckCircle2 } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { MaintenanceReportSummary } from '@/lib/types';
import { tx } from '@/lib/format';
import { PageKpiCard } from '@/components/ui/page-kpi-card';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';

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
  // Arabic-Indic zero "٠" renders as a small dot in most web fonts at display size;
  // use Latin '0' for that case so the value is always clearly readable.
  const num = (n: number) => n === 0 ? '0' : n.toLocaleString('ar-EG');
  const maxCategoryCount = r.byCategory[0]?.count ?? 1;
  const maxAssigneeCount = r.byAssignee[0]?.count ?? 1;

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <PageKpiCard
          label="قيد المراجعة"
          value={num(r.pendingReviewCount)}
          icon={<ClipboardClock className="h-5 w-5" />}
          tone="warning"
        />
        <PageKpiCard
          label="متأخرة"
          value={num(r.overdueCount)}
          icon={<AlarmClock className="h-5 w-5" />}
          tone="danger"
        />
        <PageKpiCard
          label="قيد التنفيذ"
          value={num(r.inProgressCount)}
          icon={<Loader2 className="h-5 w-5" />}
          tone="info"
        />
        <PageKpiCard
          label="تم الإنجاز"
          value={num(r.resolvedCount)}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="success"
        />
      </div>

      {/* Analytics panels — items-start prevents the shorter card from stretching */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Top requested categories */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-brand-500 shrink-0" />
              <CardTitle>التصنيفات الأكثر طلبًا</CardTitle>
            </div>
            {r.byCategory.length > 0 && (
              <span className="text-xs text-slate-400 tabular-nums">
                أعلى {Math.min(5, r.byCategory.length)}
              </span>
            )}
          </CardHeader>
          <CardBody className="p-0">
            {r.byCategory.length === 0 ? (
              <div className="py-10 flex flex-col items-center gap-2">
                <BarChart3 className="h-8 w-8 text-slate-200" />
                <p className="text-xs text-slate-400">لا توجد بيانات</p>
              </div>
            ) : (
              <ul className="divide-y divide-hairline">
                {r.byCategory.slice(0, 5).map((c, i) => (
                  <li key={c.categoryId} className="px-5 py-3 hover:bg-brand-50/20 transition-colors">
                    <div className="flex items-center gap-3 mb-1.5">
                      <span className="w-6 h-6 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center text-[10px] font-bold text-brand-600 shrink-0 tabular-nums">
                        {i + 1}
                      </span>
                      <span className="flex-1 text-sm font-medium text-slate-700 truncate">
                        {tx(c.categoryName)}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-surface-muted text-slate-500 text-[10px] font-semibold tabular-nums">
                          {num(c.count)} طلب
                        </span>
                        {c.overdueCount > 0 && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-danger-50 text-danger-600 text-[10px] font-semibold tabular-nums">
                            {num(c.overdueCount)} متأخر
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Progress bar — dir=ltr so fill grows left-to-right universally */}
                    <div className="ms-9 h-0.5 bg-surface-muted rounded-full overflow-hidden" dir="ltr">
                      <div
                        className="h-full bg-brand-500/25 rounded-full"
                        style={{ width: `${Math.round((c.count / maxCategoryCount) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Supervisor workload */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users2 className="h-4 w-4 text-brand-500 shrink-0" />
              <CardTitle>الأعباء على مشرفي الصيانة</CardTitle>
            </div>
            {r.byAssignee.length > 0 && (
              <span className="text-xs text-slate-400 tabular-nums">{r.byAssignee.length} مشرف</span>
            )}
          </CardHeader>
          <CardBody className="p-0">
            {r.byAssignee.length === 0 ? (
              <div className="py-10 flex flex-col items-center gap-2">
                <Users2 className="h-8 w-8 text-slate-200" />
                <p className="text-xs text-slate-400">لا توجد طلبات مُسندة</p>
              </div>
            ) : (
              <ul className="divide-y divide-hairline">
                {r.byAssignee.slice(0, 5).map((a, i) => (
                  <li key={a.userId} className="px-5 py-3 hover:bg-brand-50/20 transition-colors">
                    <div className="flex items-center gap-3 mb-1.5">
                      <span className="w-6 h-6 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center text-[10px] font-bold text-brand-600 shrink-0 tabular-nums">
                        {i + 1}
                      </span>
                      <span className="flex-1 text-sm font-medium text-slate-700 truncate">{a.name}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-surface-muted text-slate-500 text-[10px] font-semibold tabular-nums">
                          {num(a.count)} طلب
                        </span>
                        {a.inProgressCount > 0 && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-info-50 text-info-600 text-[10px] font-semibold tabular-nums">
                            {num(a.inProgressCount)} جارٍ
                          </span>
                        )}
                        {a.overdueCount > 0 && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-danger-50 text-danger-600 text-[10px] font-semibold tabular-nums">
                            {num(a.overdueCount)} متأخر
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Progress bar — dir=ltr so fill grows left-to-right universally */}
                    <div className="ms-9 h-0.5 bg-surface-muted rounded-full overflow-hidden" dir="ltr">
                      <div
                        className="h-full bg-brand-500/25 rounded-full"
                        style={{ width: `${Math.round((a.count / maxAssigneeCount) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
