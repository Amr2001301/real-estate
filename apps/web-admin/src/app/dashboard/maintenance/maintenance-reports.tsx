import { ClipboardClock, AlarmClock, Loader2, CheckCircle2 } from 'lucide-react';
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
  const num = (n: number) => n.toLocaleString('ar-EG');

  return (
    <div className="space-y-4">
      {/* Essential KPIs — 4 cards */}
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

      {/* Analytics — 2 ranked-list panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top requested categories */}
        <Card>
          <CardHeader>
            <CardTitle>التصنيفات الأكثر طلبًا</CardTitle>
            {r.byCategory.length > 0 && (
              <span className="text-xs text-slate-400 tabular-nums">{r.byCategory.length} تصنيف</span>
            )}
          </CardHeader>
          <CardBody className="p-0">
            {r.byCategory.length === 0 ? (
              <p className="px-5 py-8 text-center text-xs text-slate-400">لا توجد بيانات.</p>
            ) : (
              <ul className="divide-y divide-hairline">
                {r.byCategory.slice(0, 5).map((c, i) => (
                  <li key={c.categoryId} className="flex items-center gap-3 px-5 py-3 hover:bg-brand-50/20 transition-colors">
                    <span className="w-5 h-5 rounded-full bg-surface-muted/80 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0 tabular-nums">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-sm text-slate-700">{tx(c.categoryName)}</span>
                    <div className="flex items-center gap-3 text-xs tabular-nums">
                      <span className="text-slate-500">{num(c.count)} طلب</span>
                      {c.overdueCount > 0 && (
                        <span className="font-medium text-danger-600">{num(c.overdueCount)} متأخر</span>
                      )}
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
            <CardTitle>الأعباء على مشرفي الصيانة</CardTitle>
            {r.byAssignee.length > 0 && (
              <span className="text-xs text-slate-400 tabular-nums">{r.byAssignee.length} مشرف</span>
            )}
          </CardHeader>
          <CardBody className="p-0">
            {r.byAssignee.length === 0 ? (
              <p className="px-5 py-8 text-center text-xs text-slate-400">لا توجد طلبات مُسندة.</p>
            ) : (
              <ul className="divide-y divide-hairline">
                {r.byAssignee.slice(0, 5).map((a, i) => (
                  <li key={a.userId} className="flex items-center gap-3 px-5 py-3 hover:bg-brand-50/20 transition-colors">
                    <span className="w-5 h-5 rounded-full bg-surface-muted/80 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0 tabular-nums">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-sm text-slate-700">{a.name}</span>
                    <div className="flex items-center gap-3 text-xs tabular-nums">
                      <span className="text-slate-500">{num(a.count)} طلب</span>
                      {a.inProgressCount > 0 && (
                        <span className="text-info-600">{num(a.inProgressCount)} جارٍ</span>
                      )}
                      {a.overdueCount > 0 && (
                        <span className="font-medium text-danger-600">{num(a.overdueCount)} متأخر</span>
                      )}
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
