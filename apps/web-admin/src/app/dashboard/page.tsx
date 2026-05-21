import {
  Building2,
  Home,
  Zap,
  CalendarCheck2,
  Receipt,
  Wrench,
  Banknote,
  AlertCircle,
  FileText,
  Cloud,
  ArrowLeft,
  Plus,
} from 'lucide-react';
import Link from 'next/link';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { PageKpiCard } from '@/components/ui/page-kpi-card';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { ChartPanel } from '@/components/dashboard/chart-panel';
import { BookingsTrendChart } from '@/components/dashboard/bookings-trend-chart';
import { LeadSourceDonut } from '@/components/dashboard/lead-source-donut';
import { AlertList } from '@/components/dashboard/alert-list';
import { ActivityTable } from '@/components/dashboard/activity-table';
import { SupportCard } from '@/components/dashboard/support-card';
import { SalesDashboard } from './_components/sales-home';

interface Kpis {
  projects: number;
  units: { total: number; available: number; reserved: number; sold: number };
  leads: { total: number; new: number };
  pendingVisits: number;
  contracts: number;
  depositsTotal: number | string;
}

// TODO(phase-5): wire to real /reports/* endpoints when available.
const BOOKINGS_TREND = [
  { month: 'يناير', value: 32 },
  { month: 'فبراير', value: 41 },
  { month: 'مارس', value: 28 },
  { month: 'أبريل', value: 47 },
  { month: 'مايو', value: 38 },
  { month: 'يونيو', value: 64, highlight: true },
];

const LEAD_SOURCES = [
  { label: 'مباشر', value: 74, color: '#C99A2E' },
  { label: 'وسائل التواصل', value: 18, color: '#1E3348' },
  { label: 'إحالة', value: 6, color: '#94A3B8' },
  { label: 'موقع الويب', value: 2, color: '#CBD5E1' },
];

const ALERTS = [
  {
    id: '1',
    tone: 'danger' as const,
    title: '5 عقود بانتظار التوقيع',
    description: 'تجاوزت المهلة المحددة بـ 24 ساعة',
    icon: <FileText />,
  },
  {
    id: '2',
    tone: 'info' as const,
    title: 'ودائع بانتظار التأكيد',
    description: 'عدد 2 معاملة بنكية جديدة',
    icon: <Banknote />,
  },
  {
    id: '3',
    tone: 'neutral' as const,
    title: 'تحديثات النظام',
    description: 'نسخة احتياطية مكتملة',
    icon: <Cloud />,
  },
];

const ACTIVITIES = [
  {
    id: 'a1',
    user: 'أحمد منصور',
    action: 'حجز الوحدة 402',
    entity: 'برج الجوار',
    time: 'منذ ساعتين',
  },
  {
    id: 'a2',
    user: 'سارة كمال',
    action: 'طلب صيانة جديد',
    entity: 'فيلا الياقوت',
    time: 'منذ 4 ساعات',
  },
  {
    id: 'a3',
    user: 'محمد علي',
    action: 'توقيع عقد رقم #490',
    entity: 'مجمع النخيل',
    time: 'منذ 6 ساعات',
  },
];

export default async function DashboardHome() {
  // Non-admin staff (SALES) get a sales-focused home built from endpoints they
  // can access — the admin /reports/kpis call below is ADMIN-only and would
  // 403 for them. ADMIN keeps the existing dashboard unchanged.
  const session = await getSession();
  if (session && session.role !== 'ADMIN') {
    return <SalesDashboard userId={session.id} />;
  }

  const r = await safe(api.get<Kpis>('/reports/kpis'));
  const kpis = r.data;
  const error = r.error;

  return (
    <div className="space-y-5">
      <PageHeader
        title="مرحباً بك في المجلس الرقمي"
        description="نظرة عامة على أداء المحفظة العقارية والعمليات الجارية اليوم."
        actions={
          <>
            <Button
              variant="outline"
              size="md"
              leftIcon={<FileText className="h-4 w-4" />}
            >
              توليد تقرير
            </Button>
            <Link href={'/dashboard/projects/new' as never}>
              <Button
                variant="primary"
                size="md"
                leftIcon={<Plus className="h-4 w-4" />}
              >
                مشروع جديد
              </Button>
            </Link>
          </>
        }
      />

      {error && (
        <div className="rounded-2xl bg-warning-50 text-warning-700 p-4 text-sm flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">تعذر تحميل المؤشرات الحية</p>
            <p className="text-xs mt-0.5 text-warning-700/80">{error}</p>
          </div>
        </div>
      )}

      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          <PageKpiCard
            label="إجمالي المشاريع"
            value={kpis.projects}
            icon={<Building2 />}
            tone="brand"
          />
          <PageKpiCard
            label="الوحدات المتاحة"
            value={kpis.units.available}
            sub={`من إجمالي ${kpis.units.total}`}
            icon={<Home />}
            tone="info"
          />
          <PageKpiCard
            label="الفرص الجديدة"
            value={kpis.leads.new}
            sub={kpis.leads.new > 0 ? `+${kpis.leads.new} هذا الشهر` : undefined}
            icon={<Zap />}
            tone="accent"
          />
          <PageKpiCard
            label="الحجوزات النشطة"
            value={kpis.units.reserved}
            icon={<CalendarCheck2 />}
            tone="success"
          />
          <PageKpiCard
            label="ودائع معلقة"
            value={kpis.pendingVisits}
            icon={<Receipt />}
            tone="warning"
          />
          <PageKpiCard
            label="طلبات صيانة"
            value={7}
            sub="بيانات تجريبية"
            icon={<Wrench />}
            tone="danger"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartPanel
          title="توزيع العملاء المحتملين"
          description="حسب مصدر القناة"
          className="lg:col-span-1"
        >
          <LeadSourceDonut
            slices={LEAD_SOURCES}
            centerLabel="74%"
            centerSub="مباشر"
          />
        </ChartPanel>

        <ChartPanel
          title="اتجاهات الحجوزات"
          description="مقارنة الـ 6 أشهر الماضية"
          className="lg:col-span-2"
          trailing={
            <span className="inline-flex items-center h-7 px-3 rounded-full bg-brand-50 text-brand-700 text-2xs font-semibold">
              آخر 6 أشهر
            </span>
          }
        >
          <BookingsTrendChart data={BOOKINGS_TREND} />
        </ChartPanel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="overflow-hidden lg:col-span-1">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-hairline">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-danger-50 text-danger-600 shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5">
              <AlertCircle className="h-3.5 w-3.5" />
            </span>
            <h3 className="text-sm font-semibold text-slate-800 tracking-tight">
              تنبيهات معلقة
            </h3>
          </div>
          <div className="p-4 sm:p-5">
            <AlertList items={ALERTS} />
          </div>
        </Card>

        <Card className="overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between px-5 py-3 border-b border-hairline">
            <h3 className="text-sm font-semibold text-slate-800 tracking-tight">
              آخر النشاطات
            </h3>
            <Link
              href={'/dashboard/audit' as never}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800 transition-colors"
            >
              عرض الكل
              <ArrowLeft className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="p-4 sm:p-5">
            <ActivityTable rows={ACTIVITIES} />
          </div>
        </Card>
      </div>

      <SupportCard />
    </div>
  );
}
