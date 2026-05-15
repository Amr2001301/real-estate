import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, Unit, User } from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
import ContractForm from './form';

export default async function NewContractPage() {
  const [unitsRes, customersRes, customersRes2] = await Promise.all([
    safe(api.get<Paged<Unit>>('/units?status=AVAILABLE&pageSize=100')),
    safe(api.get<Paged<User>>('/users?role=CLIENT&pageSize=100')),
    safe(api.get<Paged<User>>('/users?role=CUSTOMER&pageSize=100')),
  ]);

  const customers = [
    ...(customersRes.data?.data ?? []),
    ...(customersRes2.data?.data ?? []),
  ];

  return (
    <div className="space-y-6 pb-2">
      <PageHeader
        title="عقد يدوي جديد"
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'العقود', href: '/dashboard/contracts' },
          { label: 'عقد جديد' },
        ]}
      />

      {/* Advisory note */}
      <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800 space-y-1">
          <p className="font-semibold">الطريقة المُفضَّلة: تحويل حجز</p>
          <p>
            يُنصح بإنشاء العقود عبر تحويل حجز موافَق عليه — يضمن ذلك ربط الحجز بالعقد تلقائياً،
            وتوليد خطة التقسيط من البيانات المحفوظة في الحجز.
          </p>
          <p>
            استخدم هذه الصفحة فقط عند الحاجة لإنشاء عقد يدوي بدون حجز مسبق.
          </p>
          <Link href="/dashboard/reservations" className="font-medium underline">
            الذهاب إلى الحجوزات ←
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-2xl">
        <ContractForm
          units={unitsRes.data?.data ?? []}
          customers={customers}
        />
      </div>
    </div>
  );
}
