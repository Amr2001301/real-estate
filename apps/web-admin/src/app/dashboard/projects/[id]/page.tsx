import Link from 'next/link';
import { api, safe } from '@/lib/api';
import type { Project } from '@/lib/types';
import { tx } from '@/lib/format';
import { ProjectStatusBadge } from '@/components/badges';
import ProjectForm from '../_form';
import {
  publishProjectAction,
  archiveProjectAction,
  deleteProjectAction,
  createPhaseAction,
  createBuildingAction,
} from '../actions';
import { ProjectMediaPanel } from './media-panel';
import { ConfirmButton } from '@/components/confirm-button';

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = await safe(api.get<Project>(`/projects/${id}`));

  if (r.error) {
    return (
      <div className="rounded-lg bg-red-50 text-red-700 p-4 text-sm">{r.error}</div>
    );
  }
  const project = r.data!;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/projects" className="text-sm text-brand-600 hover:underline">
            ← المشاريع
          </Link>
          <h1 className="text-2xl font-bold mt-1 flex items-center gap-3">
            {tx(project.name)}
            <ProjectStatusBadge status={project.status} />
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {project.city} · {project.lat}, {project.lng}
          </p>
        </div>
        <div className="flex gap-2">
          {project.status !== 'PUBLISHED' && (
            <form action={publishProjectAction.bind(null, id)}>
              <button className="rounded-lg bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 text-sm">
                نشر
              </button>
            </form>
          )}
          {project.status !== 'ARCHIVED' && (
            <form action={archiveProjectAction.bind(null, id)}>
              <button className="rounded-lg bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 text-sm">
                أرشفة
              </button>
            </form>
          )}
          <ConfirmButton
            label="حذف"
            confirm="هل أنت متأكد من حذف هذا المشروع؟ لا يمكن التراجع."
            action={deleteProjectAction.bind(null, id)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold mb-4">تفاصيل المشروع</h2>
          <ProjectForm project={project} />
        </section>

        <aside className="space-y-6">
          <ProjectMediaPanel project={project} />
          <PhasesPanel project={project} />
        </aside>
      </div>
    </div>
  );
}

function PhasesPanel({ project }: { project: Project }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <h2 className="text-lg font-bold mb-3">المراحل والمباني</h2>

      {(!project.phases || project.phases.length === 0) && (
        <p className="text-sm text-gray-500 mb-4">لا توجد مراحل بعد</p>
      )}

      <div className="space-y-3">
        {project.phases?.map((ph) => (
          <div key={ph.id} className="border border-gray-100 rounded-lg p-3">
            <div className="font-medium text-sm">{tx(ph.name)}</div>
            {ph.buildings && ph.buildings.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {ph.buildings.map((b) => (
                  <li key={b.id} className="text-xs text-gray-600 flex justify-between">
                    <span>
                      {b.name} <span className="text-gray-400">· {b.totalFloors} طوابق</span>
                    </span>
                    <span className="text-gray-400">{b._count?.units ?? 0} وحدة</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-400 mt-1">لا توجد مباني</p>
            )}

            <details className="mt-2">
              <summary className="text-xs text-brand-600 cursor-pointer">+ إضافة مبنى</summary>
              <form action={createBuildingAction.bind(null, project.id)} className="mt-2 space-y-2">
                <input type="hidden" name="phaseId" value={ph.id} />
                <input
                  name="name"
                  required
                  placeholder="اسم المبنى (مثال: A)"
                  className="w-full text-xs rounded-md border border-gray-300 px-2 py-1"
                />
                <input
                  name="totalFloors"
                  type="number"
                  min={1}
                  defaultValue={1}
                  placeholder="عدد الطوابق"
                  className="w-full text-xs rounded-md border border-gray-300 px-2 py-1"
                />
                <button className="w-full text-xs rounded-md bg-gray-100 hover:bg-gray-200 px-2 py-1">
                  حفظ
                </button>
              </form>
            </details>
          </div>
        ))}
      </div>

      <details className="mt-4">
        <summary className="text-sm text-brand-600 cursor-pointer">+ إضافة مرحلة</summary>
        <form action={createPhaseAction.bind(null, project.id)} className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              name="name_ar"
              required
              dir="rtl"
              placeholder="بالعربية"
              className="text-xs rounded-md border border-gray-300 px-2 py-1"
            />
            <input
              name="name_en"
              required
              dir="ltr"
              placeholder="English"
              className="text-xs rounded-md border border-gray-300 px-2 py-1"
            />
          </div>
          <input
            name="order"
            type="number"
            placeholder="الترتيب"
            defaultValue={project.phases?.length ?? 0}
            className="w-full text-xs rounded-md border border-gray-300 px-2 py-1"
          />
          <button className="w-full text-xs rounded-md bg-brand-600 text-white px-2 py-1.5">
            إضافة المرحلة
          </button>
        </form>
      </details>
    </section>
  );
}
