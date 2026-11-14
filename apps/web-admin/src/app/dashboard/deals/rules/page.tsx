import { api, safe } from '@/lib/api';
import { getReportsCurrency } from '@/lib/currency';
import { getLocale } from '@/lib/locale';
import { getSession } from '@/lib/session';
import { uiT } from '@/messages/ui';
import { PremiumPageHero } from '@/components/premium';
import { dealsT, type CommissionRule } from '@/components/deals/messages';
import { DealsTabs } from '../_components/ui';
import { RuleCard } from '../_components/rule-card';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/** BRK-3 — the company's commission rates per deal type; the admin sets them. */
export default async function RulesPage() {
  const [locale, currency, session] = await Promise.all([getLocale(), getReportsCurrency(), getSession()]);
  const m = dealsT(locale);
  const isAdmin = session?.role === 'ADMIN';
  const res = await safe(api.get<CommissionRule[]>('/deals/rules'));
  return (
    <div className="flex flex-col gap-6" data-testid="rules-page">
      <PremiumPageHero
        eyebrow={m.list.title}
        title={m.rules.title}
        description={m.rules.desc}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: m.list.title, href: '/dashboard/deals' },
          { label: m.rules.title },
        ]}
      />
      <DealsTabs active="rules" locale={locale} isAdmin={isAdmin} />
      {res.error && <div role="alert" className="rounded-2xl border border-danger-100 bg-danger-50 p-4 text-sm text-danger-700">{res.error}</div>}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {(res.data ?? []).map((r) => (
          <RuleCard key={r.kind} rule={r} locale={locale} currency={currency} canEdit={isAdmin} />
        ))}
      </div>
    </div>
  );
}
