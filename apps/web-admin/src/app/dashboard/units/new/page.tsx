import Link from 'next/link';
import { api, safe } from '@/lib/api';
import type { Paged, Project } from '@/lib/types';
import UnitForm from '../_form';

export default async function NewUnitPage() {
  const r = await safe(api.get<Paged<Project>>('/projects?pageSize=100'));
  return (
    <div>
      <div className="mb-4">
        <Link href="/dashboard/units" className="text-sm text-brand-600 hover:underline">
          ← العودة للوحدات
        </Link>
      </div>
      <h1 className="text-2xl font-bold mb-6">وحدة جديدة</h1>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        {r.error ? (
          <div className="rounded-lg bg-red-50 text-red-700 p-3 text-sm">{r.error}</div>
        ) : (
          <UnitForm projects={r.data?.data ?? []} />
        )}
      </div>
    </div>
  );
}
