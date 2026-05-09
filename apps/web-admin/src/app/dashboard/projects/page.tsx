import Link from 'next/link';
import { api, safe } from '@/lib/api';
import type { Paged, Project } from '@/lib/types';
import { tx, formatDate } from '@/lib/format';
import { DataTable } from '@/components/table';
import { ProjectStatusBadge } from '@/components/badges';

export default async function ProjectsPage() {
  const result = await safe(api.get<Paged<Project>>('/projects?pageSize=50'));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">المشاريع</h1>
        <Link
          href="/dashboard/projects/new"
          className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm hover:bg-brand-700"
        >
          + مشروع جديد
        </Link>
      </div>

      {result.error && (
        <div className="rounded-lg bg-red-50 text-red-700 p-4 mb-4 text-sm">{result.error}</div>
      )}

      {result.data && (
        <DataTable
          rowKey={(p) => p.id}
          rows={result.data.data}
          columns={[
            { key: 'name', header: 'الاسم', cell: (p) => <span className="font-medium">{tx(p.name)}</span> },
            { key: 'city', header: 'المدينة', cell: (p) => <span className="text-gray-600">{p.city}</span> },
            { key: 'status', header: 'الحالة', cell: (p) => <ProjectStatusBadge status={p.status} /> },
            { key: 'featured', header: 'مميز', cell: (p) => (p.featured ? '★' : '—') },
            { key: 'createdAt', header: 'تاريخ الإنشاء', cell: (p) => <span className="text-gray-500">{formatDate(p.createdAt)}</span> },
            {
              key: 'actions',
              header: '',
              cell: (p) => (
                <Link href={`/dashboard/projects/${p.id}`} className="text-brand-600 hover:underline">
                  عرض / تعديل
                </Link>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
