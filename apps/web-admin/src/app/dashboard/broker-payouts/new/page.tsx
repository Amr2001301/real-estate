import { Banknote, AlertCircle } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { AdminEligibleCommission, Broker, Paged } from '@/lib/types';
import { getReportsCurrency } from '@/lib/currency';
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
  const [brokersRes, currency] = await Promise.all([
    safe(api.get<Paged<Broker>>('/brokers?pageSize=200')),
    getReportsCurrency(),
  ]);
  const brokers = brokersRes.data?.data ?? [];

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
        title="دفعة جديدة"
        description="ابدأ باختيار شركة الوساطة، ثم حدد العمولات المعتمدة لإدراجها في الدفعة."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الوسطاء', href: '/dashboard/brokers' },
          { label: 'المدفوعات', href: '/dashboard/broker-payouts' },
          { label: 'دفعة جديدة' },
        ]}
        meta={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-2.5 py-1 text-[11px] font-bold text-brand-700">
            <Banknote className="h-3.5 w-3.5" />
            دفعة جديدة
          </span>
        }
      />

      {eligibleError && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>تعذر تحميل العمولات: {eligibleError}</p>
        </div>
      )}

      <CreatePayoutForm
        brokers={brokers.map((b) => ({ id: b.id, companyName: b.companyName }))}
        selectedBrokerId={sp.brokerId ?? ''}
        brokerName={broker?.companyName ?? null}
        eligible={eligible}
        currency={currency}
      />
    </div>
  );
}
