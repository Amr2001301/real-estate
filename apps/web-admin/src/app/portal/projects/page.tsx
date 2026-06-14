import { api, safe } from '@/lib/api';
import type { PortalProject } from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
import { ProjectsPanel } from '@/components/broker/projects-panel';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function PortalProjectsPage() {
  const r = await safe(api.get<PortalProject[]>('/portal/projects'));
  const projects = r.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="المشاريع المتاحة"
        description="قائمة المشاريع المُصرَّح لك بالعمل عليها وفقاً لصلاحيات حساب الوساطة."
        breadcrumbs={[
          { label: 'البوابة', href: '/portal' },
          { label: 'المشاريع' },
        ]}
      />

      {r.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل المشاريع: {r.error}
        </div>
      )}

      <ProjectsPanel projects={projects} />
    </div>
  );
}
