import Link from 'next/link';
import { Building2, CheckCircle2, Clock, AlertTriangle, XCircle, Plus } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { getLocale } from '@/lib/locale';
import { saT } from '@/messages/super-admin';
import { Button } from '@/components/ui/button';
import {
  PremiumPageHero,
  PremiumMetricStrip,
  PremiumSectionCard,
} from '@/components/premium';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Platform Management' };

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

export default async function SuperAdminOverviewPage() {
  const [locale, res] = await Promise.all([
    getLocale(),
    safe(api.get<CompanySummary[]>('/super-admin/companies')),
  ]);

  const m = saT(locale);
  const companies = res.data ?? [];

  const total = companies.length;
  const active = companies.filter((c) => c.subscriptionStatus === 'ACTIVE').length;
  const trial = companies.filter((c) => c.subscriptionStatus === 'TRIAL').length;
  const suspended = companies.filter((c) =>
    ['SUSPENDED', 'CANCELLED', 'EXPIRED'].includes(c.subscriptionStatus),
  ).length;
  const now = Date.now();
  const expiringSoon = companies.filter((c) => {
    if (!['ACTIVE', 'CANCELLING'].includes(c.subscriptionStatus)) return false;
    if (!c.subscriptionEndAt) return false;
    const diff = new Date(c.subscriptionEndAt).getTime() - now;
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
  }).length;

  return (
    <div className="space-y-6">
      <PremiumPageHero
        title={m.overview.title}
        description={m.overview.description}
        badge={{ label: m.overview.badge }}
        breadcrumbs={[{ label: m.overview.breadcrumbs.platform }]}
        actions={
          <Link href="/dashboard/super-admin/companies/new">
            <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />}>
              {m.overview.newCompany}
            </Button>
          </Link>
        }
      >
        <PremiumMetricStrip
          variant="compact"
          cols={4}
          className="border-t border-hairline px-7 sm:px-9 py-5"
          metrics={[
            { label: m.overview.kpi.total,        value: total,        icon: <Building2 />,     tone: 'neutral' },
            { label: m.overview.kpi.active,        value: active,       icon: <CheckCircle2 />,  tone: 'success' },
            { label: m.overview.kpi.trial,         value: trial,        icon: <Clock />,         tone: 'info' },
            { label: m.overview.kpi.expiringSoon,  value: expiringSoon, icon: <AlertTriangle />, tone: 'warning' },
          ]}
        />
      </PremiumPageHero>

      <PremiumSectionCard
        title={m.overview.tableTitleFn(total)}
        icon={<Building2 />}
        padded={false}
      >
        {companies.length === 0 ? (
          <div className="py-12 text-center p-6">
            <Building2 className="h-10 w-10 mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-500">{m.overview.empty}</p>
            <Link href="/dashboard/super-admin/companies/new" className="mt-3 inline-block text-sm text-brand-600 hover:underline">
              {m.overview.emptyLink}
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-right text-xs text-slate-500 border-b border-hairline bg-canvas/40">
                <tr>
                  <th className="px-5 py-3 font-semibold">{m.overview.cols.company}</th>
                  <th className="px-4 py-3 font-semibold">{m.overview.cols.plan}</th>
                  <th className="px-4 py-3 font-semibold">{m.overview.cols.status}</th>
                  <th className="px-4 py-3 font-semibold">{m.overview.cols.users}</th>
                  <th className="px-4 py-3 font-semibold">{m.overview.cols.endAt}</th>
                  <th className="px-4 py-3 font-semibold">{m.overview.cols.createdAt}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id} className="border-b border-hairline hover:bg-canvas/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-900">{c.name}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{c.slug}</p>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 text-[13px]">
                      {m.plan[c.subscriptionPlan] ?? c.subscriptionPlan}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_BADGE[c.subscriptionStatus] ?? 'bg-slate-100 text-slate-600'}`}>
                        {m.status[c.subscriptionStatus] ?? c.subscriptionStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 tabular-nums text-slate-700 text-[13px]">
                      {c.userCount}{c.maxUsers ? ` / ${c.maxUsers}` : ''}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 text-[12px]">
                      {c.subscriptionEndAt ? formatDate(c.subscriptionEndAt, locale) : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-400 text-[12px]">
                      {formatDate(c.createdAt, locale)}
                    </td>
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/dashboard/super-admin/companies/${c.id}`}
                        className="text-brand-600 text-[12px] font-semibold hover:underline"
                      >
                        {m.overview.manageLinkLabel}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PremiumSectionCard>

      {suspended > 0 && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-red-100 bg-red-50/40 px-5 py-3.5 text-sm text-red-700">
          <XCircle className="h-4 w-4 shrink-0" />
          <span>{m.overview.suspendedWarning(suspended)}</span>
        </div>
      )}
    </div>
  );
}
