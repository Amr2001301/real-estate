import { notFound } from 'next/navigation';
import Link from 'next/link';
import { api, safe } from '@/lib/api';
import type { Project } from '@/lib/types';
import { tx } from '@/lib/format';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import ProjectForm from '../../_form';

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [r, locale] = await Promise.all([
    safe(api.get<Project>(`/projects/${id}`)),
    getLocale(),
  ]);
  if (r.error || !r.data) notFound();
  const project = r.data;
  const m = uiT(locale);
  const n = m.pages.projectsEdit;

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <div className="relative bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand-200 via-brand-500 to-brand-200" />
        <div className="px-7 sm:px-9 pt-8 pb-7">
          <nav className="flex items-center gap-1.5 text-[12px] text-slate-400 mb-3">
            <Link href="/dashboard" className="hover:text-navy transition-colors">{m.common.breadcrumbHome}</Link>
            <span>/</span>
            <Link href="/dashboard/projects" className="hover:text-navy transition-colors">{m.nav.items.projects}</Link>
            <span>/</span>
            <Link href={`/dashboard/projects/${id}` as never} className="hover:text-navy transition-colors">{tx(project.name)}</Link>
            <span>/</span>
            <span className="text-navy font-medium">{n.breadcrumb}</span>
          </nav>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-navy">{`${n.titlePrefix} ${tx(project.name)}`}</h1>
              <p className="text-sm text-slate-500 mt-1">{n.description}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-3 py-1.5 text-xs font-bold text-brand-700 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
              {n.badge}
            </span>
          </div>
        </div>
      </div>
      <ProjectForm project={project} locale={locale} />
    </div>
  );
}
