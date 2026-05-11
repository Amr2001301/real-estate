import { api, safe } from '@/lib/api';
import type { User } from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
import ClientForm from '../../_form';

export const dynamic = 'force-dynamic';

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = await safe(api.get<User>(`/users/${id}`));

  if (r.error || !r.data) {
    return (
      <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-6 text-sm">
        تعذر تحميل العميل: {r.error ?? 'غير موجود'}
      </div>
    );
  }

  const user = r.data;
  const role = (user.role === 'CUSTOMER' ? 'CUSTOMER' : 'CLIENT') as
    | 'CLIENT'
    | 'CUSTOMER';

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title={`تعديل ملف ${user.fullName}`}
        description="تحديث البيانات الشخصية ومعلومات التواصل المسموح بها."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'العملاء', href: `/dashboard/clients?role=${role}` },
          { label: user.fullName, href: `/dashboard/clients/${id}` },
          { label: 'تعديل' },
        ]}
      />
      <ClientForm user={user} />
    </div>
  );
}
