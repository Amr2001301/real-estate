'use client';
import { useRouter } from 'next/navigation';

interface Project { id: string; name: string }

export function ProjectSelect({
  value,
  projects,
  preserveParams,
}: {
  value: string;
  projects: Project[];
  preserveParams: Record<string, string>;
}) {
  const router = useRouter();

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
      <option value="">كل المشاريع</option>
      {projects.map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  );
}
