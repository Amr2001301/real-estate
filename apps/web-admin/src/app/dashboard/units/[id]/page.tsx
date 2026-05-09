import Link from 'next/link';
import { api, safe } from '@/lib/api';
import type { Paged, Unit, Project } from '@/lib/types';
import { tx, formatCurrency } from '@/lib/format';
import { UnitStatusBadge } from '@/components/badges';
import { ConfirmButton } from '@/components/confirm-button';
import UnitForm from '../_form';
import { UnitMediaPanel } from './media-panel';
import { deleteUnitAction } from '../actions';

export default async function UnitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [unitRes, projectsRes] = await Promise.all([
    safe(api.get<Unit>(`/units/${id}`)),
    safe(api.get<Paged<Project>>('/projects?pageSize=100')),
  ]);

  if (unitRes.error) {
    return <div className="rounded-lg bg-red-50 text-red-700 p-4 text-sm">{unitRes.error}</div>;
  }
  const unit = unitRes.data!;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/units" className="text-sm text-brand-600 hover:underline">
            ← الوحدات
          </Link>
          <h1 className="text-2xl font-bold mt-1 flex items-center gap-3">
            {unit.code}
            <UnitStatusBadge status={unit.status} />
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {tx(unit.building?.phase?.project?.name)} · {unit.building?.name} · الطابق {unit.floor}
          </p>
          <p className="text-lg font-semibold text-brand-700 mt-1">{formatCurrency(unit.price)}</p>
        </div>
        <ConfirmButton
          label="حذف الوحدة"
          confirm="هل أنت متأكد من حذف هذه الوحدة؟"
          action={deleteUnitAction.bind(null, id)}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold mb-4">تعديل الوحدة</h2>
          <UnitForm unit={unit} projects={projectsRes.data?.data ?? []} />
        </section>

        <UnitMediaPanel unit={unit} />
      </div>
    </div>
  );
}
