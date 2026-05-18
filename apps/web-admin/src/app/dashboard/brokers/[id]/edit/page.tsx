import { notFound } from 'next/navigation';
import { api, safe } from '@/lib/api';
import type { Broker } from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
import BrokerForm from '../../_form';
import BrokerStatusForm from './_status-form';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function EditBrokerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = await safe(api.get<Broker>(`/brokers/${id}`));
  if (r.error || !r.data) notFound();
  const broker = r.data;

  return (
    <div className="space-y-8 lg:space-y-10">
      <PageHeader
        title={`تعديل: ${broker.companyName}`}
        description="حدّث البيانات أو غيّر حالة الوسيط. التغييرات تطبق فور الحفظ."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الوسطاء', href: '/dashboard/brokers' },
          { label: broker.companyName, href: `/dashboard/brokers/${id}` },
          { label: 'تعديل' },
        ]}
      />

      <BrokerForm broker={broker} />

      <section id="status" className="scroll-mt-24">
        <BrokerStatusForm broker={broker} />
      </section>
    </div>
  );
}
