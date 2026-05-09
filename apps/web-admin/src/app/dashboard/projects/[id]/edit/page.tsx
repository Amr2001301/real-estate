import { notFound } from 'next/navigation';
import { api, safe } from '@/lib/api';
import type { Project } from '@/lib/types';
import { tx } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import ProjectForm from '../../_form';

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = await safe(api.get<Project>(`/projects/${id}`));
  if (r.error || !r.data) notFound();
  const project = r.data;

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title={`تعديل: ${tx(project.name)}`}
        description="حدّث بيانات المشروع. التغييرات تطبق فور الحفظ."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'المشاريع', href: '/dashboard/projects' },
          { label: tx(project.name), href: `/dashboard/projects/${id}` },
          { label: 'تعديل' },
        ]}
      />
      <ProjectForm project={project} />
    </div>
  );
}
