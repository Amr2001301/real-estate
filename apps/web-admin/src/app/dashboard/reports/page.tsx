import { BarChart2, CalendarDays, CheckCircle2, DollarSign, FileBarChart, FileText } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { formatCurrency, tx } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { KpiCard } from '@/components/ui/kpi-card';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ExportMenu } from '@/components/export-menu';
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

const RESERVATION_STATUS_LABEL: Record<string, string> = {
  PENDING:   'قيد الانتظار',
  CONFIRMED: 'مؤكد',
  APPROVED:  'معتمد',
  CONVERTED: 'محوّل إلى عقد',
  CANCELLED: 'ملغى',
  EXPIRED:   'منتهٍ',
};

const RESERVATION_STATUS_TONE: Record<string, BadgeTone> = {
  PENDING:   'warning',
  CONFIRMED: 'success',
  APPROVED:  'success',
  CONVERTED: 'brand',
  CANCELLED: 'danger',
  EXPIRED:   'gray',
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
  const byProject = salesRes.data?.byProject ?? [];

  return (
    <div className="space-y-5">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <PageHeader
        className="mb-0"
        title="التقارير"
        description="ملخص مؤشرات المنصة المالية والتشغيلية خلال الفترة المحددة."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'التقارير' },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ExportMenu
              label="تصدير المبيعات"
              xlsxPath="/reports/sales/export.xlsx"
              csvPath="/reports/sales/export.csv"
              filenameBase="sales-report"
              params={{ period }}
            />
            <ExportMenu
              label="تصدير المالية"
              xlsxPath="/reports/financial/export.xlsx"
              csvPath="/reports/financial/export.csv"
              filenameBase="financial-report"
              params={{ period }}
            />
            <ExportMenu
              label="تصدير التشغيلي"
              xlsxPath="/reports/operational/export.xlsx"
              csvPath="/reports/operational/export.csv"
              filenameBase="operational-report"
            />
          </div>
        }
      />

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <ReportsTabs active="sales" />

      {/* ── Period filter ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-hairline bg-surface px-5 py-3 shadow-xs">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <CalendarDays className="h-3.5 w-3.5" />
        </span>
        <span className="text-sm font-medium text-slate-700 shrink-0">الفترة الزمنية</span>
        <div className="w-px h-5 bg-hairline shrink-0 hidden sm:block" aria-hidden />
        <form method="get" className="flex items-center gap-2 ms-auto sm:ms-0">
          <input
            name="period"
            type="month"
            defaultValue={period}
            className="rounded-xl border border-hairline bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 shadow-xs transition-colors"
          />
          <Button type="submit" variant="primary" size="sm">
            تطبيق
          </Button>
        </form>
      </div>

      {/* ── Error banner ──────────────────────────────────────────────────── */}
      {(salesRes.error || financialRes.error || reservationsRes.error) && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          {salesRes.error || financialRes.error || reservationsRes.error}
        </div>
      )}

      {/* ── KPI cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          tone="brand"
          label="المبيعات"
          icon={<BarChart2 />}
          value={
            <span dir="ltr" className="whitespace-nowrap">
              {formatCurrency(salesRes.data?.total ?? 0)}
            </span>
          }
          sub={`${salesRes.data?.contracts ?? 0} عقد`}
        />
        <KpiCard
          tone="success"
          label="الدفعات المسجلة"
          icon={<DollarSign />}
          value={
            <span dir="ltr" className="whitespace-nowrap">
              {formatCurrency(financialRes.data?.total ?? 0)}
            </span>
          }
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

      {/* ── Two-column lower section ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">

        {/* Sales by project — wider col */}
        <Card className="overflow-hidden lg:col-span-3">
          <CardHeader className="flex items-center gap-2.5 px-5 py-3.5 border-b border-hairline">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <FileBarChart className="h-3.5 w-3.5" />
            </span>
            <CardTitle className="text-sm font-semibold text-slate-800">
              المبيعات حسب المشروع
            </CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            {byProject.length === 0 ? (
              <EmptyState
                icon={<FileText />}
                title="لا توجد مبيعات"
                description="لا توجد بيانات مبيعات للفترة المحددة."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500 border-b border-hairline">
                    <tr>
                      <th className="text-start font-semibold py-2.5 ps-5 pe-4">المشروع</th>
                      <th className="text-start font-semibold py-2.5 px-4 whitespace-nowrap">العقود</th>
                      <th className="text-start font-semibold py-2.5 ps-4 pe-5 whitespace-nowrap">إجمالي المبيعات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byProject.map((p) => (
                      <tr
                        key={p.projectId}
                        className="border-t border-hairline hover:bg-surface-muted/40 align-middle transition-colors"
                      >
                        <td className="py-3 ps-5 pe-4 font-medium text-slate-900">
                          {projectMap.get(p.projectId) ?? (
                            <span className="text-slate-400 font-normal">مشروع غير معروف</span>
                          )}
                        </td>
                        <td className="py-3 px-4 tabular-nums text-slate-600 whitespace-nowrap">
                          {p.count} عقد
                        </td>
                        <td className="py-3 ps-4 pe-5 font-semibold tabular-nums text-slate-900 whitespace-nowrap" dir="ltr">
                          {formatCurrency(p.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Reservation status — narrower col */}
        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader className="flex items-center gap-2.5 px-5 py-3.5 border-b border-hairline">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <FileText className="h-3.5 w-3.5" />
            </span>
            <CardTitle className="text-sm font-semibold text-slate-800">
              حالة الحجوزات
            </CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            {reservationEntries.length === 0 ? (
              <EmptyState
                icon={<FileText />}
                title="لا توجد حجوزات"
                description="لا توجد بيانات حجوزات حتى الآن."
              />
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500 border-b border-hairline">
                  <tr>
                    <th className="text-start font-semibold py-2.5 ps-5 pe-4">الحالة</th>
                    <th className="text-end font-semibold py-2.5 ps-4 pe-5">العدد</th>
                  </tr>
                </thead>
                <tbody>
                  {reservationEntries.map(([status, count]) => (
                    <tr
                      key={status}
                      className="border-t border-hairline hover:bg-surface-muted/40 align-middle transition-colors"
                    >
                      <td className="py-3 ps-5 pe-4">
                        <Badge
                          tone={RESERVATION_STATUS_TONE[status] ?? 'gray'}
                          size="sm"
                        >
                          {RESERVATION_STATUS_LABEL[status] ?? status}
                        </Badge>
                      </td>
                      <td className="py-3 ps-4 pe-5 text-end font-semibold tabular-nums text-slate-900">
                        {count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>

      </div>
    </div>
  );
}
