import Link from 'next/link';
import { api, safe } from '@/lib/api';
import type { Paged, Contract } from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
import RecordDepositForm from './form';

export const dynamic = 'force-dynamic';

export default async function NewDepositPage({
  searchParams,
}: {
  searchParams: Promise<{ contractId?: string }>;
}) {
  const sp = await searchParams;
  const r = await safe(api.get<Paged<Contract>>('/contracts?pageSize=200'));

  return (
    <div className="space-y-6">
      <PageHeader
        title="تسجيل دفعة جديدة"
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الدفعات', href: '/dashboard/deposits' },
          { label: 'تسجيل دفعة' },
        ]}
      />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-2xl">
        {r.error ? (
          <div className="rounded-lg bg-red-50 text-red-700 p-3 text-sm">{r.error}</div>
        ) : (
          <RecordDepositForm contracts={r.data?.data ?? []} initialContractId={sp.contractId} />
        )}
      </div>
    </div>
  );
}
