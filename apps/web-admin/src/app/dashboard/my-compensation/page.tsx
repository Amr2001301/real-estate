import {
  Clock,
  CheckCircle2,
  Banknote,
  Hash,
  Target,
  Users,
  CalendarClock,
  BookmarkCheck,
  FileText,
  AlertCircle,
  Wallet,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import type { Paged, Lead, Reservation, VisitAppointment } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { PageHeader } from '@/components/ui/page-header';
import { PageKpiCard } from '@/components/ui/page-kpi-card';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

export const dynamic = 'force-dynamic';

type EntryStatus = 'PENDING' | 'APPROVED' | 'PAID';

interface BonusEntry {
  id: string;
  amount: string | number;
  period: string;
  status: EntryStatus;
  paidAt: string | null;
  createdAt?: string;
  rule?: { name: string };
}
interface SalesTarget {
  id: string;
  period: string;
  amountTarget: string | number;
  unitsTarget: number;
}

const STATUS_LABEL: Record<EntryStatus, string> = {
  PENDING: 'معلق',
  APPROVED: 'معتمد',
  PAID: 'مدفوع',
};
const STATUS_CLS: Record<EntryStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-info-100 text-info-700',
  PAID: 'bg-success-100 text-success-700',
};

function SectionError() {
  return (
    <div className="flex items-start gap-2 text-warning-700 text-sm p-4">
      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
      <p>تعذّر تحميل هذا القسم.</p>
    </div>
  );
}

export default async function MyCompensationPage() {
  const session = await getSession();
  const nowIso = new Date().toISOString();

  // Every read is self-scoped server-side. We deliberately do NOT pass salesId:
  // the API scopes /bonus-entries and /sales-targets to the authenticated SALES
  // user via the token. /visits/appointments is scoped by the user's own
  // session id (not client input). No ADMIN-only endpoints are called.
  const [bonusRes, targetsRes, leadsRes, reservationsRes, visitsRes] =
    await Promise.all([
      safe(api.get<BonusEntry[] | Paged<BonusEntry>>('/bonus-entries')),
      safe(api.get<SalesTarget[]>('/sales-targets')),
      safe(api.get<Paged<Lead>>('/leads?pageSize=100')),
      safe(api.get<Paged<Reservation>>('/reservations?pageSize=100')),
      session
        ? safe(
            api.get<Paged<VisitAppointment>>(
              `/visits/appointments?assignedSalesId=${session.id}&scheduledFrom=${nowIso}&pageSize=50`,
            ),
          )
        : Promise.resolve({ data: undefined, error: 'لا توجد جلسة' as string }),
    ]);

  const entries = Array.isArray(bonusRes.data)
    ? bonusRes.data
    : (bonusRes.data?.data ?? []);
  const targets = targetsRes.data ?? [];
  const leads = leadsRes.data?.data ?? [];
  const reservations = reservationsRes.data?.data ?? [];
  const upcomingVisits = visitsRes.data?.data ?? [];

  const sumByStatus = (s: EntryStatus) =>
    entries
      .filter((e) => e.status === s)
      .reduce((acc, e) => acc + Number(e.amount || 0), 0);
  const pendingTotal = sumByStatus('PENDING');
  const approvedTotal = sumByStatus('APPROVED');
  const paidTotal = sumByStatus('PAID');

  // Performance KPIs from self-scoped data. Converted reservations stand in for
  // closed deals — no broad /contracts call (no sales-scoped contracts endpoint
  // exists yet). TODO(batch-5): use a sales-scoped contracts endpoint when one
  // is available to count signed contracts directly.
  const openLeads = leads.filter((l) => l.stage !== 'WON' && l.stage !== 'LOST').length;
  const activeReservations = reservations.filter(
    (r) => r.status === 'PENDING' || r.status === 'APPROVED',
  ).length;
  const convertedDeals = reservations.filter((r) => r.status === 'CONVERTED').length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="مستحقاتي وأهدافي"
        description="عرض خاص بك لمستحقات العمولات والمكافآت، وأهداف المبيعات، وملخّص أدائك. للعرض فقط."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'مستحقاتي وأهدافي' },
        ]}
      />

      {/* ── A. Compensation summary ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <PageKpiCard label="إجمالي المعلق" value={formatCurrency(pendingTotal)} icon={<Clock />} tone="warning" />
        <PageKpiCard label="إجمالي المعتمد" value={formatCurrency(approvedTotal)} icon={<CheckCircle2 />} tone="info" />
        <PageKpiCard label="إجمالي المدفوع" value={formatCurrency(paidTotal)} icon={<Banknote />} tone="success" />
        <PageKpiCard label="عدد المستحقات" value={entries.length.toLocaleString('ar-EG')} icon={<Hash />} tone="brand" />
      </div>

      {/* ── B. My compensation entries ──────────────────────────────────────── */}
      <Card>
        <CardHeader className="px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-brand-500 shrink-0" />
            <CardTitle className="text-sm">مستحقاتي</CardTitle>
          </div>
          {!bonusRes.error && (
            <span className="text-xs text-slate-400 tabular-nums">
              {entries.length.toLocaleString('ar-EG')} مستحق
            </span>
          )}
        </CardHeader>
        <CardBody className="p-0">
          {bonusRes.error ? (
            <SectionError />
          ) : entries.length === 0 ? (
            <EmptyState icon={<Wallet />} title="لا توجد مستحقات حتى الآن" className="py-12" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-slate-50 text-xs text-slate-400 border-b border-hairline">
                  <tr>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">الفترة</th>
                    <th className="px-4 py-2.5 text-right font-medium">القاعدة</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">المبلغ</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">الحالة</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">تاريخ الدفع</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">تاريخ الإنشاء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {entries.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-2.5 text-slate-500 tabular-nums whitespace-nowrap">{e.period}</td>
                      <td className="px-4 py-2.5 text-slate-600">{e.rule?.name ?? '—'}</td>
                      <td className="px-4 py-2.5 font-semibold tabular-nums whitespace-nowrap text-slate-800">{formatCurrency(e.amount)}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={cn('inline-block px-2 py-0.5 rounded-full text-[11px] font-medium leading-tight', STATUS_CLS[e.status])}>
                          {STATUS_LABEL[e.status]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500 tabular-nums whitespace-nowrap">{formatDate(e.paidAt)}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500 tabular-nums whitespace-nowrap">{formatDate(e.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* ── C. My targets ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-brand-500 shrink-0" />
            <CardTitle className="text-sm">أهدافي</CardTitle>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {targetsRes.error ? (
            <SectionError />
          ) : targets.length === 0 ? (
            <EmptyState icon={<Target />} title="لا توجد أهداف محدّدة بعد" className="py-12" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <thead className="bg-slate-50 text-xs text-slate-400 border-b border-hairline">
                  <tr>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">الشهر</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">هدف القيمة</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">هدف الوحدات</th>
                  </tr>
                </thead>
                {/* TODO(batch-5): show achieved amount/units vs. target once a
                    sales performance endpoint exposes realized figures. */}
                <tbody className="divide-y divide-hairline">
                  {targets.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-2.5 text-slate-500 tabular-nums whitespace-nowrap">{t.period}</td>
                      <td className="px-4 py-2.5 font-semibold tabular-nums whitespace-nowrap text-slate-800">{formatCurrency(t.amountTarget)}</td>
                      <td className="px-4 py-2.5 text-slate-600 tabular-nums whitespace-nowrap">{t.unitsTarget.toLocaleString('ar-EG')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* ── D. Performance summary ──────────────────────────────────────────── */}
      <Card>
        <CardHeader className="px-5 py-3.5">
          <CardTitle className="text-sm">ملخّص أدائي</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <PageKpiCard
              label="فرصي المفتوحة"
              value={leadsRes.error ? '—' : openLeads}
              icon={<Users />}
              tone="brand"
            />
            <PageKpiCard
              label="زياراتي القادمة"
              value={visitsRes.error ? '—' : upcomingVisits.length}
              icon={<CalendarClock />}
              tone="neutral"
            />
            <PageKpiCard
              label="حجوزاتي النشطة"
              value={reservationsRes.error ? '—' : activeReservations}
              icon={<BookmarkCheck />}
              tone="success"
            />
            <PageKpiCard
              label="صفقاتي المحوّلة"
              value={reservationsRes.error ? '—' : convertedDeals}
              sub="حجوزات محوّلة إلى عقود"
              icon={<FileText />}
              tone="info"
            />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
