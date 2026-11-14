import { redirect } from 'next/navigation';
import { Shuffle } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getLocale } from '@/lib/locale';
import { getSession } from '@/lib/session';
import { uiT } from '@/messages/ui';
import { PremiumPageHero, PremiumMetricStrip, PremiumEmptyState } from '@/components/premium';
import { developersT } from '@/components/developers/messages';
import { Panel } from '@/app/dashboard/deals/_components/ui';
import { DistributeForm } from '../_brokerage/distribute-form';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/** BRK-5 «توزيع العملاء» — hand the unassigned leads to the team at once, by workload. */
export default async function DistributePage() {
  const [locale, session] = await Promise.all([getLocale(), getSession()]);
  if (session?.role !== 'ADMIN' && session?.role !== 'SALES_MANAGER') redirect('/dashboard/leads');
  const t = developersT(locale).distribute;
  const res = await safe(api.get<{ unassigned: number; reps: Array<{ id: string; fullName: string; openLeads: number }> }>('/leads/distribute'));
  const data = res.data ?? { unassigned: 0, reps: [] };
  const crumbs = uiT(locale);

  return (
    <div className="flex flex-col gap-6" data-testid="distribute-page">
      <PremiumPageHero
        eyebrow={crumbs.nav.items.leads}
        title={t.title}
        description={t.desc}
        breadcrumbs={[
          { label: crumbs.common.breadcrumbHome, href: '/dashboard' },
          { label: crumbs.nav.items.leads, href: '/dashboard/leads' },
          { label: t.title },
        ]}
      >
        <PremiumMetricStrip
          cols={2}
          metrics={[
            { label: t.unassigned, value: data.unassigned },
            { label: t.team, value: data.reps.length },
          ]}
        />
      </PremiumPageHero>

      {res.error && <div role="alert" className="rounded-2xl border border-danger-100 bg-danger-50 p-4 text-sm text-danger-700">{res.error}</div>}

      {data.unassigned === 0 ? (
        <div className="rounded-[22px] border border-dashed border-hairline bg-surface">
          <PremiumEmptyState icon={<Shuffle />} title={t.nothing} />
        </div>
      ) : (
        <Panel icon={<Shuffle />} title={t.pick}>
          <DistributeForm locale={locale} reps={data.reps} unassigned={data.unassigned} />
        </Panel>
      )}
    </div>
  );
}
