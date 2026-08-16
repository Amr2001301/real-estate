import { Banknote, AlertCircle } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { AdminEligibleCommission, Broker, Paged } from '@/lib/types';
import { getReportsCurrency } from '@/lib/currency';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { PremiumPageHero } from '@/components/premium';
import CreatePayoutForm from './_form';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  brokerId?: string;
}

export default async function NewBrokerPayoutPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const [brokersRes, currency, locale] = await Promise.all([
    safe(api.get<Paged<Broker>>('/brokers?pageSize=200')),
    getReportsCurrency(),
    getLocale(),
  ]);
  const brokers = brokersRes.data?.data ?? [];
  const m = uiT(locale);
  const n = m.pages.brokerPayoutsNew;

  let eligible: AdminEligibleCommission[] = [];
  let eligibleError: string | null = null;

  if (sp.brokerId) {
    const eligibleRes = await safe(
      api.get<Paged<AdminEligibleCommission>>(
        `/broker-payouts/eligible-commissions?brokerId=${sp.brokerId}&pageSize=500`,
      ),
    );
    eligible = eligibleRes.data?.data ?? [];
    eligibleError = eligibleRes.error ?? null;
  }

  const broker = brokers.find((b) => b.id === sp.brokerId);

  return (
    <div className="space-y-5">
      <PremiumPageHero
        title={n.title}
        description={n.description}
        breadcrumbs={[
          { label: m.common.breadcrumbHome, href: '/dashboard' },
          { label: m.nav.items.brokers, href: '/dashboard/brokers' },
          { label: m.nav.items.brokerPayouts, href: '/dashboard/broker-payouts' },
          { label: n.breadcrumb },
        ]}
        meta={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-2.5 py-1 text-[11px] font-bold text-brand-700">
            <Banknote className="h-3.5 w-3.5" />
            {n.badge}
          </span>
        }
      />

      {eligibleError && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>{n.eligibleError} {eligibleError}</p>
        </div>
      )}

      <CreatePayoutForm
        brokers={brokers.map((b) => ({ id: b.id, companyName: b.companyName }))}
        selectedBrokerId={sp.brokerId ?? ''}
        brokerName={broker?.companyName ?? null}
        eligible={eligible}
        currency={currency}
        locale={locale}
      />
    </div>
  );
}
