import { notFound } from 'next/navigation';
import Link from 'next/link';
import { api, safe } from '@/lib/api';
import type { Project } from '@/lib/types';
import { tx } from '@/lib/format';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { pcT } from '@/messages/project-content';
import { Tabs } from '@/components/ui/tabs';
import { ProjectContentEditor, type ContentTab, type ProjectContent } from './content-editor';

const TABS: ContentTab[] = ['sections', 'amenities', 'faqs', 'progress'];

/** «محتوى صفحة المشروع»: sections, amenities, FAQ and construction progress, one tab each. */
export default async function ProjectContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [r, locale] = await Promise.all([safe(api.get<Project>(`/projects/${id}`)), getLocale()]);
  if (r.error || !r.data) notFound();
  const project = r.data;
  const m = uiT(locale);
  const t = pcT(locale);
  const tab: ContentTab = TABS.includes(sp.tab as ContentTab) ? (sp.tab as ContentTab) : 'sections';
  const base = `/dashboard/projects/${id}/content`;
  const initial: ProjectContent = {
    sections: project.sections ?? [],
    faqs: project.faqs ?? [],
    amenities: project.amenities ?? [],
    progressStages: project.progressStages ?? [],
    progressUpdatedAt: project.progressUpdatedAt ?? null,
  };

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <div className="relative overflow-hidden rounded-[22px] border border-hairline bg-surface">
        <div className="px-7 pb-7 pt-8 sm:px-9">
          <nav className="mb-3 flex items-center gap-1.5 text-[12px] text-slate-400">
            <Link href="/dashboard" className="transition-colors hover:text-navy">{m.common.breadcrumbHome}</Link>
            <span>/</span>
            <Link href="/dashboard/projects" className="transition-colors hover:text-navy">{m.nav.items.projects}</Link>
            <span>/</span>
            <Link href={`/dashboard/projects/${id}` as never} className="transition-colors hover:text-navy">{tx(project.name)}</Link>
            <span>/</span>
            <span className="font-medium text-navy">{t.breadcrumb}</span>
          </nav>
          <h1 className="text-2xl font-bold text-navy">{t.title(tx(project.name))}</h1>
          <p className="mt-1 text-sm text-slate-500">{t.subtitle}</p>
        </div>
      </div>

      <div>
        <Tabs
          items={TABS.map((k) => ({
            label: t.tabs[k],
            href: `${base}?tab=${k}`,
            count: k === 'progress' ? initial.progressStages.length : initial[k].length,
          }))}
          activeHref={`${base}?tab=${tab}`}
          className="mb-5"
        />
        <ProjectContentEditor
          key={tab}
          projectId={id}
          projectName={{ ar: project.name?.ar ?? '', en: project.name?.en ?? '' }}
          tab={tab}
          initial={initial}
          locale={locale}
        />
      </div>
    </div>
  );
}
