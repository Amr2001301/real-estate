import Link from 'next/link';
import { Plus, Building2, AlertCircle } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { getLocale } from '@/lib/locale';
import { saT } from '@/messages/super-admin';
import { Button } from '@/components/ui/button';
import { PremiumPageHero, PremiumSectionCard } from '@/components/premium';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Companies — Platform Admin' };

interface CompanySummary {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  currency: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  subscriptionStartAt: string | null;
  subscriptionEndAt: string | null;
  userCount: number;
  maxUsers: number | null;
  cancelledAt: string | null;
  cancelReason: string | null;
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

export default async function CompaniesPage() {
  const [locale, res] = await Promise.all([
    getLocale(),
    safe(api.get<CompanySummary[]>('/super-admin/companies')),
  ]);

  const m = saT(locale);

  if (res.error) {
    return (
      <div className="space-y-6">
        <PremiumPageHero
          title={m.companies.title}
          breadcrumbs={[
            { label: m.companies.breadcrumbs.platform, href: '/dashboard/super-admin' },
            { label: m.companies.breadcrumbs.companies },
          ]}
        />
        <div className="flex items-center gap-2.5 rounded-2xl border border-red-100 bg-red-50/40 px-5 py-3.5 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {m.companies.errorPrefix} {res.error}
        </div>
      </div>
    );
  }

  const companies = res.data ?? [];

  return (
    <div className="space-y-6">
      <PremiumPageHero
        title={m.companies.title}
        description={m.companies.descriptionFn(companies.length)}
        badge={{ label: m.companies.badge }}
        breadcrumbs={[
          { label: m.companies.breadcrumbs.platform, href: '/dashboard/super-admin' },
          { label: m.companies.breadcrumbs.companies },
        ]}
        actions={
          <Link href="/dashboard/super-admin/companies/new">
            <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />}>
              {m.companies.newBtn}
            </Button>
          </Link>
        }
      />

      <PremiumSectionCard
        title={m.companies.tableTitle}
        icon={<Building2 />}
        padded={false}
      >
        {companies.length === 0 ? (
          <div className="py-14 text-center px-6">
            <Building2 className="h-10 w-10 mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-500">{m.companies.empty}</p>
            <Link href="/dashboard/super-admin/companies/new" className="mt-3 inline-block text-sm text-brand-600 hover:underline">
              {m.companies.emptyLink}
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-right text-xs text-slate-500 border-b border-hairline bg-canvas/40">
                <tr>
                  <th className="px-5 py-3 font-semibold">{m.companies.cols.company}</th>
                  <th className="px-4 py-3 font-semibold">{m.companies.cols.plan}</th>
                  <th className="px-4 py-3 font-semibold">{m.companies.cols.status}</th>
                  <th className="px-4 py-3 font-semibold">{m.companies.cols.users}</th>
                  <th className="px-4 py-3 font-semibold">{m.companies.cols.startAt}</th>
                  <th className="px-4 py-3 font-semibold">{m.companies.cols.endAt}</th>
                  <th className="px-4 py-3 font-semibold">{m.companies.cols.createdAt}</th>
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
                      {c.subscriptionStartAt ? formatDate(c.subscriptionStartAt) : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 text-[12px]">
                      {c.subscriptionEndAt ? formatDate(c.subscriptionEndAt) : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-400 text-[12px]">
                      {formatDate(c.createdAt)}
                    </td>
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/dashboard/super-admin/companies/${c.id}`}
                        className="text-brand-600 text-[12px] font-semibold hover:underline"
                      >
                        {m.companies.manageLinkLabel}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PremiumSectionCard>
    </div>
  );
}
