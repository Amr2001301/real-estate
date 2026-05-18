import Link from 'next/link';
import {
  Activity,
  BadgePercent,
  BarChart3,
  Bell,
  Briefcase,
  Eye,
  FileText,
  Gauge,
  ScrollText,
  TrendingUp,
  Users as UsersIcon,
  Wallet,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type {
  AuditLogItem,
  OperationsSummary,
  Paged,
} from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageKpiCard } from '@/components/ui/page-kpi-card';
import { EmptyState } from '@/components/ui/empty-state';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const QUICK_LINKS: Array<{
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { href: '/dashboard/audit-logs', label: 'سجلات التدقيق', icon: ScrollText },
  { href: '/dashboard/notifications', label: 'الإشعارات', icon: Bell },
  { href: '/dashboard/broker-reports', label: 'تقارير الوسطاء', icon: BarChart3 },
  { href: '/dashboard/broker-payouts', label: 'المدفوعات', icon: Wallet },
  { href: '/dashboard/broker-commissions', label: 'العمولات', icon: BadgePercent },
  { href: '/dashboard/broker-leads', label: 'فرص الوسطاء', icon: Briefcase },
];

export default async function OperationsCenterPage() {
  const [summaryRes, recentRes] = await Promise.all([
    safe(api.get<OperationsSummary>('/operations/summary')),
    safe(api.get<Paged<AuditLogItem>>('/audit-logs?pageSize=10')),
  ]);

  const summary = summaryRes.data;
  const recent = recentRes.data?.data ?? [];
  const topActor = summary?.topActors[0]?.actor;
  const topEntity = summary?.topEntities[0]?.entityType ?? null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="مركز العمليات"
        description="نظرة سريعة على نشاط النظام: من فعل ماذا، ومتى. الأرقام مأخوذة من سجلات التدقيق."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'مركز العمليات' },
        ]}
        meta={<Gauge className="h-4 w-4 text-brand-600" />}
      />

      {(summaryRes.error || recentRes.error) && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل بعض البيانات: {summaryRes.error ?? recentRes.error}
        </div>
      )}

      {summary && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <PageKpiCard
              label="أحداث اليوم"
              value={summary.totals.today}
              icon={<Activity />}
              tone="brand"
            />
            <PageKpiCard
              label="أحداث الأسبوع"
              value={summary.totals.last7Days}
              icon={<TrendingUp />}
              tone="info"
            />
            <PageKpiCard
              label="أكثر مستخدم نشاطًا (٧ أيام)"
              value={topActor?.fullName ?? '—'}
              icon={<UsersIcon />}
              tone="success"
              sub={topActor?.email ?? topActor?.role}
            />
            <PageKpiCard
              label="أكثر مساحة نشاطًا"
              value={topEntity ?? '—'}
              icon={<FileText />}
              tone="accent"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="p-5 lg:col-span-2 overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <ScrollText className="h-4 w-4 text-brand-600" />
                  أحدث الأحداث
                </h2>
                <Link href="/dashboard/audit-logs">
                  <Button variant="ghost" size="sm">عرض الكل</Button>
                </Link>
              </div>
              {recent.length === 0 ? (
                <EmptyState
                  icon={<ScrollText />}
                  title="لا توجد أحداث بعد"
                  description="ستظهر هنا فور وقوع أول إجراء مُسجّل."
                />
              ) : (
                <ul className="divide-y divide-hairline">
                  {recent.map((row) => (
                    <li key={row.id} className="py-2.5 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm">
                          <span className="font-medium text-slate-900">
                            {row.actor?.fullName ?? 'نظام'}
                          </span>
                          <span className="text-slate-500"> — </span>
                          <span className="font-mono text-xs text-slate-700" dir="ltr">
                            {row.action} {row.entityType}
                          </span>
                        </p>
                        <p className="text-2xs text-slate-500 mt-0.5">
                          {formatDateTime(row.createdAt)}
                          {row.ip && <> • {row.ip}</>}
                        </p>
                      </div>
                      <Link href={`/dashboard/audit-logs/${row.id}`}>
                        <Button variant="ghost" size="sm" leftIcon={<Eye className="h-3.5 w-3.5" />}>
                          عرض
                        </Button>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">روابط سريعة</h2>
              <div className="flex flex-col gap-2">
                {QUICK_LINKS.map((q) => (
                  <Link key={q.href} href={q.href as never}>
                    <Button
                      variant="outline"
                      size="md"
                      fullWidth
                      leftIcon={<q.icon className="h-4 w-4" />}
                    >
                      {q.label}
                    </Button>
                  </Link>
                ))}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">توزيع حسب الإجراء (٧ أيام)</h2>
              {summary.topActions.length === 0 ? (
                <p className="text-2xs text-slate-500">—</p>
              ) : (
                <ul className="space-y-2">
                  {summary.topActions.map((a) => (
                    <li key={a.action} className="flex items-center justify-between text-sm">
                      <span className="font-mono text-xs text-slate-700" dir="ltr">{a.action}</span>
                      <span className="font-semibold tabular-nums">{a.count.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">توزيع حسب المساحة (٧ أيام)</h2>
              {summary.topEntities.length === 0 ? (
                <p className="text-2xs text-slate-500">—</p>
              ) : (
                <ul className="space-y-2">
                  {summary.topEntities.map((e) => (
                    <li key={e.entityType} className="flex items-center justify-between text-sm">
                      <span className="font-mono text-xs text-slate-700" dir="ltr">{e.entityType}</span>
                      <span className="font-semibold tabular-nums">{e.count.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
