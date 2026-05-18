import Link from 'next/link';
import { api, safe } from '@/lib/api';
import type {
  AdminEligibleCommission,
  Broker,
  Paged,
} from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
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
  const brokersRes = await safe(api.get<Paged<Broker>>('/brokers?pageSize=200'));
  const brokers = brokersRes.data?.data ?? [];

  // Step 1: no broker selected yet → show broker picker.
  if (!sp.brokerId) {
    return (
      <div className="space-y-6 lg:space-y-8">
        <PageHeader
          title="دفعة جديدة"
          description="ابدأ باختيار شركة الوساطة، ثم حدد العمولات المعتمدة لإدراجها."
          breadcrumbs={[
            { label: 'لوحة التحكم', href: '/dashboard' },
            { label: 'الوسطاء', href: '/dashboard/brokers' },
            { label: 'المدفوعات', href: '/dashboard/broker-payouts' },
            { label: 'دفعة جديدة' },
          ]}
        />
        <Card className="p-5">
          <form method="get" action="/dashboard/broker-payouts/new" className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[260px]">
              <label className="text-sm font-medium text-slate-700 block mb-1.5">
                اختر الوسيط
              </label>
              <Select name="brokerId" defaultValue="" required>
                <option value="" disabled>اختر شركة الوساطة</option>
                {brokers.map((b) => (
                  <option key={b.id} value={b.id}>{b.companyName}</option>
                ))}
              </Select>
            </div>
            <Button type="submit" variant="primary" size="md">
              متابعة
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  // Step 2: broker selected → fetch eligible commissions.
  const broker = brokers.find((b) => b.id === sp.brokerId);
  if (!broker) {
    return (
      <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-6 text-sm">
        الوسيط المحدد غير موجود.{' '}
        <Link href="/dashboard/broker-payouts/new" className="underline">
          اختر وسيطاً آخر
        </Link>
      </div>
    );
  }

  const eligibleRes = await safe(
    api.get<Paged<AdminEligibleCommission>>(
      `/broker-payouts/eligible-commissions?brokerId=${sp.brokerId}&pageSize=500`,
    ),
  );
  const eligible = eligibleRes.data?.data ?? [];

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title="دفعة جديدة"
        description={`اختر العمولات المعتمدة من ${broker.companyName} لإدراجها في الدفعة.`}
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الوسطاء', href: '/dashboard/brokers' },
          { label: 'المدفوعات', href: '/dashboard/broker-payouts' },
          { label: 'دفعة جديدة' },
        ]}
        actions={
          <Link href="/dashboard/broker-payouts/new">
            <Button variant="ghost" size="md">تغيير الوسيط</Button>
          </Link>
        }
      />

      {eligibleRes.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل العمولات: {eligibleRes.error}
        </div>
      )}

      <CreatePayoutForm
        brokerId={broker.id}
        brokerName={broker.companyName}
        eligible={eligible}
      />
    </div>
  );
}
