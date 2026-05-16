import { BarChart2, DollarSign, FileText, CheckCircle2 } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { formatCurrency, tx } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { KpiCard } from '@/components/ui/kpi-card';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { ReportsTabs } from './_components/reports-tabs';

interface Sales {
  contracts: number;
  total: number | string;
  byProject?: Array<{ projectId: string; total: number; count: number }>;
}
interface Financial {
  deposits: number;
  verified: number;
  total: number | string;
}
interface ProjectOption { id: string; name: { ar: string; en: string } }
interface PagedProjects { data: ProjectOption[] }

const RESERVATION_STATUS_LABELS: Record<string, string> = {
  PENDING: 'قيد الانتظار',
  CONFIRMED: 'مؤكد',
  CONVERTED: 'محوّل إلى عقد',
  CANCELLED: 'ملغى',
  EXPIRED: 'منتهي',
};

const RESERVATION_STATUS_CLS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  CONFIRMED: 'bg-green-100 text-green-700',
  CONVERTED: 'bg-brand-100 text-brand-700',
  CANCELLED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-slate-100 text-slate-500',
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const sp = await searchParams;
  const period = sp.period ?? new Date().toISOString().slice(0, 7);

  const [salesRes, financialRes, reservationsRes, projectsRes] = await Promise.all([
    safe(api.get<Sales>(`/reports/sales?period=${period}`)),
    safe(api.get<Financial>(`/reports/financial?period=${period}`)),
    safe(api.get<Record<string, number>>('/reports/reservations')),
    safe(api.get<PagedProjects>('/projects?pageSize=100')),
  ]);

  const projectMap = new Map<string, string>(
    (projectsRes.data?.data ?? []).map((p) => [p.id, tx(p.name)]),
  );

  const reservationEntries = Object.entries(reservationsRes.data ?? {});

  return (
    <div className="space-y-5">
      {/* Header — mb-0 overrides PageHeader's built-in mb-8 */}
      <PageHeader
        className="mb-0"
        title="التقارير"
        description="نظرة عامة على المبيعات والحجوزات والمالية للفترة المحددة."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'التقارير' },
        ]}
      />

      <ReportsTabs active="sales" />

      {/* Period filter */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-hairline bg-white px-4 py-2.5 shadow-xs">
        <span className="text-xs font-medium text-slate-500 shrink-0">الفترة الزمنية:</span>
        <form method="get" className="flex items-center gap-2">
          <input
            name="period"
            type="month"
            defaultValue={period}
            className="rounded-xl border border-hairline px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 shadow-xs transition-colors"
          />
          <button
            type="submit"
            className="rounded-xl bg-brand-600 text-white px-4 py-1.5 text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            تطبيق
          </button>
        </form>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          tone="brand"
          label="المبيعات"
          icon={<BarChart2 />}
          value={formatCurrency(salesRes.data?.total ?? 0)}
          sub={`${salesRes.data?.contracts ?? 0} عقد`}
        />
        <KpiCard
          tone="success"
          label="الدفعات المسجلة"
          icon={<DollarSign />}
          value={formatCurrency(financialRes.data?.total ?? 0)}
          sub={`${financialRes.data?.deposits ?? 0} دفعة`}
        />
        <KpiCard
          tone="info"
          label="المتحقق منها"
          icon={<CheckCircle2 />}
          value={(financialRes.data?.verified ?? 0).toLocaleString('ar-EG')}
          sub="دفعة متحققة"
        />
      </div>

      {/* Sales by project */}
      {salesRes.data?.byProject && salesRes.data.byProject.length > 0 && (
        <Card>
          <CardHeader className="px-5 py-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-brand-500 shrink-0" />
              <CardTitle className="text-sm">المبيعات حسب المشروع</CardTitle>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 border-b border-hairline">
                  <tr>
                    <th className="px-4 py-2 text-right font-medium">المشروع</th>
                    <th className="px-4 py-2 text-right font-medium whitespace-nowrap">العقود</th>
                    <th className="px-4 py-2 text-right font-medium whitespace-nowrap">إجمالي المبيعات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {salesRes.data.byProject.map((p) => (
                    <tr key={p.projectId} className="hover:bg-slate-50/60">
                      <td className="px-4 py-2.5 font-medium">
                        {projectMap.get(p.projectId) ?? (
                          <span className="text-slate-400 font-normal">مشروع غير معروف</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-slate-600">{p.count} عقد</td>
                      <td className="px-4 py-2.5 font-semibold tabular-nums whitespace-nowrap text-slate-800">
                        {formatCurrency(p.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Reservation status */}
      <Card>
        <CardHeader className="px-5 py-3">
          <CardTitle className="text-sm">حالة الحجوزات</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {reservationEntries.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">لا توجد بيانات</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {reservationEntries.map(([status, count]) => (
                <li key={status} className="flex items-center justify-between px-5 py-2.5">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium leading-tight ${
                      RESERVATION_STATUS_CLS[status] ?? 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {RESERVATION_STATUS_LABELS[status] ?? status}
                  </span>
                  <span className="font-semibold tabular-nums text-slate-800">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {(salesRes.error || financialRes.error || reservationsRes.error) && (
        <div className="rounded-lg bg-red-50 text-red-700 p-4 text-sm">
          {salesRes.error || financialRes.error || reservationsRes.error}
        </div>
      )}
    </div>
  );
}
