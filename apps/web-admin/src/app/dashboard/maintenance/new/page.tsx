import Link from 'next/link';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, User } from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardBody } from '@/components/ui/card';
import { NewMaintenanceForm } from './new-maintenance-form';

export const dynamic = 'force-dynamic';

export default async function NewMaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const sp = await searchParams;
  const [customersRes, adminsRes] = await Promise.all([
    safe(api.get<Paged<User>>('/users?role=CUSTOMER&pageSize=200')),
    safe(api.get<Paged<User>>('/users?role=ADMIN,MAINTENANCE_SUPERVISOR&pageSize=100')),
  ]);

  const customers = customersRes.data?.data ?? [];
  const admins = adminsRes.data?.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="طلب صيانة جديد"
        description="إنشاء طلب صيانة نيابة عن العميل. عند اختيار مسؤول يبدأ الطلب بحالة «مسند»، وإلا «مفتوح»."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الصيانة', href: '/dashboard/maintenance' },
          { label: 'طلب جديد' },
        ]}
      />

      {sp.err && (
        <div className="rounded-xl bg-warning-50 border border-warning-100 text-warning-700 px-4 py-3 text-sm flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">تعذّر إنشاء الطلب</p>
            <p className="text-xs mt-0.5 text-warning-700/80">{sp.err}</p>
          </div>
        </div>
      )}

      <Card>
        <CardBody>
          <NewMaintenanceForm customers={customers} admins={admins} />
        </CardBody>
      </Card>

      <Link
        href="/dashboard/maintenance"
        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800"
      >
        <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
        العودة إلى قائمة الصيانة
      </Link>
    </div>
  );
}
