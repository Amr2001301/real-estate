import { ClipboardClock, AlarmClock, Loader2, CheckCircle2, ShieldOff, ShieldAlert, Timer, Gauge } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { MaintenanceReportSummary } from '@/lib/types';
import { tx, formatDate } from '@/lib/format';
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

// Operational maintenance report. Self-contained: a fetch failure renders a
// compact notice and never blocks the request list/category sections.
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
      <div className="rounded-xl bg-warning-50 border border-warning-100 text-warning-700 px-4 py-2.5 text-xs">
        تعذّر تحميل تقرير الصيانة: {res.error ?? 'غير متاح'}
      </div>
    );
  }
  const r = res.data;
  const num = (n: number) => n.toLocaleString('ar-EG');
  const avgRes = r.avgResolutionHours == null ? '—' : `${r.avgResolutionHours.toLocaleString('ar-EG')} ساعة`;
  const sla = r.slaAttainmentPercent == null ? '—' : `${r.slaAttainmentPercent.toLocaleString('ar-EG')}٪`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
        <PageKpiCard label="قيد المراجعة" value={num(r.pendingReviewCount)} icon={<ClipboardClock />} tone="warning" />
        <PageKpiCard label="متأخرة" value={num(r.overdueCount)} icon={<AlarmClock />} tone="danger" />
        <PageKpiCard label="قيد التنفيذ" value={num(r.inProgressCount)} icon={<Loader2 />} tone="info" />
        <PageKpiCard label="تم الحل" value={num(r.resolvedCount)} icon={<CheckCircle2 />} tone="success" />
        <PageKpiCard label="خارج الضمان" value={num(r.outOfWarrantyCount)} icon={<ShieldOff />} tone="accent" />
        <PageKpiCard label="ضمان ينتهي قريبًا" value={num(r.expiringWarranties.length)} icon={<ShieldAlert />} tone="brand" />
      </div>

      {/* Resolution-time + SLA attainment */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <PageKpiCard
          label="متوسط زمن المعالجة"
          value={avgRes}
          icon={<Timer />}
          tone="info"
        />
        <PageKpiCard
          label="الالتزام بالمدة المستهدفة"
          value={sla}
          sub={r.slaAttainmentPercent != null ? `${num(r.resolvedWithinSlaCount)} ضمن المدة · ${num(r.resolvedOverdueCount)} بعد الموعد` : undefined}
          icon={<Gauge />}
          tone={r.slaAttainmentPercent != null && r.slaAttainmentPercent >= 80 ? 'success' : 'warning'}
        />
        <PageKpiCard label="تم الحل بعد الموعد" value={num(r.resolvedOverdueCount)} icon={<AlarmClock />} tone="danger" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top categories */}
        <Card>
          <CardHeader className="px-5 py-3"><CardTitle className="text-sm">أكثر التصنيفات طلبًا</CardTitle></CardHeader>
          <CardBody className="p-0">
            {r.byCategory.length === 0 ? (
              <p className="px-5 py-6 text-center text-xs text-slate-400">لا توجد بيانات.</p>
            ) : (
              <ul className="divide-y divide-hairline">
                {r.byCategory.slice(0, 6).map((c) => (
                  <li key={c.categoryId} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm">
                    <span className="text-slate-700">{tx(c.categoryName)}</span>
                    <span className="flex items-center gap-3 text-xs tabular-nums">
                      <span className="text-slate-500">{num(c.count)} طلب</span>
                      {c.overdueCount > 0 && <span className="text-danger-600">{num(c.overdueCount)} متأخر</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Assignee workload */}
        <Card>
          <CardHeader className="px-5 py-3"><CardTitle className="text-sm">الحمل على مشرفي الصيانة</CardTitle></CardHeader>
          <CardBody className="p-0">
            {r.byAssignee.length === 0 ? (
              <p className="px-5 py-6 text-center text-xs text-slate-400">لا توجد طلبات مُسندة.</p>
            ) : (
              <ul className="divide-y divide-hairline">
                {r.byAssignee.slice(0, 6).map((a) => (
                  <li key={a.userId} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm">
                    <span className="text-slate-700">{a.name}</span>
                    <span className="flex items-center gap-3 text-xs tabular-nums">
                      <span className="text-slate-500">{num(a.count)} طلب</span>
                      {a.inProgressCount > 0 && <span className="text-info-600">{num(a.inProgressCount)} قيد التنفيذ</span>}
                      {a.overdueCount > 0 && <span className="text-danger-600">{num(a.overdueCount)} متأخر</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Out-of-warranty by category */}
        <Card>
          <CardHeader className="px-5 py-3"><CardTitle className="text-sm">طلبات خارج الضمان</CardTitle></CardHeader>
          <CardBody className="p-0">
            {r.byCategory.filter((c) => c.outOfWarrantyCount > 0).length === 0 ? (
              <p className="px-5 py-6 text-center text-xs text-slate-400">لا توجد عناصر خارج الضمان.</p>
            ) : (
              <ul className="divide-y divide-hairline">
                {r.byCategory.filter((c) => c.outOfWarrantyCount > 0).slice(0, 6).map((c) => (
                  <li key={c.categoryId} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm">
                    <span className="text-slate-700">{tx(c.categoryName)}</span>
                    <span className="text-xs tabular-nums text-accent-700">{num(c.outOfWarrantyCount)} عنصر</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Expiring warranties */}
        <Card>
          <CardHeader className="px-5 py-3"><CardTitle className="text-sm">ضمانات تنتهي خلال 30 يومًا</CardTitle></CardHeader>
          <CardBody className="p-0">
            {r.expiringWarranties.length === 0 ? (
              <p className="px-5 py-6 text-center text-xs text-slate-400">لا توجد ضمانات تنتهي قريبًا.</p>
            ) : (
              <ul className="divide-y divide-hairline">
                {r.expiringWarranties.slice(0, 8).map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm">
                    <span className="text-slate-700">
                      <span className="font-mono text-xs text-slate-500">{e.unitCode}</span> · {tx(e.categoryName)}
                    </span>
                    <span className="text-xs tabular-nums text-slate-500">{e.warrantyEnd ? formatDate(e.warrantyEnd) : '—'}</span>
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
