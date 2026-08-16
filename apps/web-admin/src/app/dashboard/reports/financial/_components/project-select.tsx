'use client';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';

interface Project { id: string; name: string }

export function ProjectSelect({
  value,
  projects,
  preserveParams,
  locale = 'ar',
}: {
  value: string;
  projects: Project[];
  preserveParams: Record<string, string>;
  locale?: Locale;
}) {
  const router = useRouter();
  const m = uiT(locale).financialReportsPage;

  return (
    <select
      defaultValue={value}
      onChange={(e) => {
        const params = new URLSearchParams(preserveParams);
        if (e.target.value) {
          params.set('projectId', e.target.value);
        } else {
          params.delete('projectId');
        }
        router.push(`/dashboard/reports/financial?${params.toString()}`);
      }}
      className="rounded-xl border border-hairline bg-white px-3 py-2 text-sm text-slate-700 shadow-xs focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-colors"
    >
      <option value="">{m.allProjectsOption}</option>
      {projects.map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  );
}
