import { PageHeader } from '@/components/ui/page-header';
import ClientForm from '../_form';

export const dynamic = 'force-dynamic';

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const sp = await searchParams;
  const role: 'CLIENT' | 'CUSTOMER' = sp.role === 'CUSTOMER' ? 'CUSTOMER' : 'CLIENT';

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title="إضافة عميل جديد"
        description="سجّل عميلاً في المنصة وحدد نوعه ومعلومات التواصل الأساسية."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'العملاء', href: `/dashboard/clients?role=${role}` },
          { label: 'عميل جديد' },
        ]}
      />
      <ClientForm defaultRole={role} />
    </div>
  );
}
