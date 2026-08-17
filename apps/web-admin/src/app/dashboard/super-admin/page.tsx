import Link from 'next/link';
import { Building2, Users, AlertTriangle, CheckCircle2, Clock, XCircle, Plus } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Super Admin — Platform Overview' };

interface CompanySummary {
  id: string;
  name: string;
  slug: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  subscriptionEndAt: string | null;
  userCount: number;
  maxUsers: number | null;
  createdAt: string;
}

const STATUS_BADGE: Record<string, string> = {
  TRIAL:      'bg-blue-100 text-blue-700',
  ACTIVE:     'bg-emerald-100 text-emerald-700',
  CANCELLING: 'bg-amber-100 text-amber-700',
  CANCELLED:  'bg-slate-100 text-slate-500',
  EXPIRED:    'bg-red-100 text-red-700',
  SUSPENDED:  'bg-red-200 text-red-800',
};

const STATUS_LABEL: Record<string, string> = {
  TRIAL: 'تجريبي', ACTIVE: 'نشط', CANCELLING: 'قيد الإلغاء',
  CANCELLED: 'ملغي', EXPIRED: 'منتهي', SUSPENDED: 'موقوف',
};

const PLAN_LABEL: Record<string, string> = {
  TRIAL: 'تجريبي', STARTER: 'أساسي', PROFESSIONAL: 'احترافي', ENTERPRISE: 'مؤسسي',
};

export default async function SuperAdminOverviewPage() {
  const res = await safe(api.get<CompanySummary[]>('/super-admin/companies'));
  const companies = res.data ?? [];

  const total = companies.length;
  const active = companies.filter((c) => c.subscriptionStatus === 'ACTIVE').length;
  const trial = companies.filter((c) => c.subscriptionStatus === 'TRIAL').length;
  const suspended = companies.filter((c) =>
    c.subscriptionStatus === 'SUSPENDED' || c.subscriptionStatus === 'CANCELLED' || c.subscriptionStatus === 'EXPIRED',
  ).length;
  const now = Date.now();
  const expiringSoon = companies.filter((c) => {
    if (c.subscriptionStatus !== 'ACTIVE' && c.subscriptionStatus !== 'CANCELLING') return false;
    if (!c.subscriptionEndAt) return false;
    const diff = new Date(c.subscriptionEndAt).getTime() - now;
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
  }).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="إدارة المنصة"
        description="نظرة شاملة على جميع الشركات المشتركة في المنصة."
        breadcrumbs={[{ label: 'لوحة التحكم', href: '/dashboard/super-admin' }]}
        actions={
          <Link
            href="/dashboard/super-admin/companies/new"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-brand-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
            شركة جديدة
          </Link>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي الشركات', value: total, icon: Building2, color: 'text-navy' },
          { label: 'نشطة', value: active, icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'تجريبية', value: trial, icon: Clock, color: 'text-blue-600' },
          { label: 'تنتهي خلال 30 يوم', value: expiringSoon, icon: AlertTriangle, color: 'text-amber-600' },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardBody>
              <div className="flex items-center gap-3">
                <kpi.icon className={`h-8 w-8 shrink-0 ${kpi.color}`} />
                <div>
                  <p className="text-2xl font-bold text-slate-900">{kpi.value}</p>
                  <p className="text-xs text-slate-500">{kpi.label}</p>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Companies table */}
      <Card>
        <CardHeader>
          <CardTitle>جميع الشركات ({total})</CardTitle>
        </CardHeader>
        <CardBody>
          {companies.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">
              لا توجد شركات بعد.{' '}
              <Link href="/dashboard/super-admin/companies/new" className="text-brand-600 hover:underline">
                أضِف الأولى
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-right text-xs text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-3 py-2 font-medium">الشركة</th>
                    <th className="px-3 py-2 font-medium">الخطة</th>
                    <th className="px-3 py-2 font-medium">الحالة</th>
                    <th className="px-3 py-2 font-medium">المستخدمون</th>
                    <th className="px-3 py-2 font-medium">تاريخ الانتهاء</th>
                    <th className="px-3 py-2 font-medium">تاريخ الإنشاء</th>
                    <th className="px-3 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c) => (
                    <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                      <td className="px-3 py-3">
                        <p className="font-semibold text-slate-900">{c.name}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{c.slug}</p>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{PLAN_LABEL[c.subscriptionPlan] ?? c.subscriptionPlan}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_BADGE[c.subscriptionStatus] ?? 'bg-slate-100 text-slate-600'}`}>
                          {STATUS_LABEL[c.subscriptionStatus] ?? c.subscriptionStatus}
                        </span>
                      </td>
                      <td className="px-3 py-3 tabular-nums text-slate-700">
                        {c.userCount}{c.maxUsers ? ` / ${c.maxUsers}` : ''}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {c.subscriptionEndAt ? formatDate(c.subscriptionEndAt) : '—'}
                      </td>
                      <td className="px-3 py-3 text-slate-400 text-[12px]">{formatDate(c.createdAt)}</td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/dashboard/super-admin/companies/${c.id}`}
                          className="text-brand-600 text-xs hover:underline"
                        >
                          إدارة
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Inactive companies warning */}
      {suspended > 0 && (
        <div className="flex items-center gap-2.5 rounded-xl border border-red-100 bg-red-50/40 px-4 py-3 text-sm text-red-700">
          <XCircle className="h-4 w-4 shrink-0" />
          <span>{suspended} شركة موقوفة أو ملغاة أو منتهية الاشتراك.</span>
        </div>
      )}
    </div>
  );
}
