import Link from 'next/link';
import { api, safe } from '@/lib/api';
import type { Paged, Unit, User } from '@/lib/types';
import ContractForm from './form';

export default async function NewContractPage() {
  const [unitsRes, customersRes] = await Promise.all([
    safe(api.get<Paged<Unit>>('/units?status=AVAILABLE&pageSize=100')),
    safe(api.get<Paged<User>>('/users?role=CLIENT&pageSize=100')),
  ]);
  const [customersRes2] = await Promise.all([
    safe(api.get<Paged<User>>('/users?role=CUSTOMER&pageSize=100')),
  ]);

  const customers = [
    ...(customersRes.data?.data ?? []),
    ...(customersRes2.data?.data ?? []),
  ];

  return (
    <div>
      <div className="mb-4">
        <Link href="/dashboard/contracts" className="text-sm text-brand-600 hover:underline">
          ← العودة للعقود
        </Link>
      </div>
      <h1 className="text-2xl font-bold mb-6">عقد جديد</h1>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-2xl">
        <ContractForm
          units={unitsRes.data?.data ?? []}
          customers={customers}
        />
      </div>
    </div>
  );
}
