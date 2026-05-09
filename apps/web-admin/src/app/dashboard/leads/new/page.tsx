import Link from 'next/link';
import { api, safe } from '@/lib/api';
import type { Paged, Project, LeadSource, User } from '@/lib/types';
import LeadForm from '../_form';

export default async function NewLeadPage() {
  const [projectsRes, sourcesRes, salesRes] = await Promise.all([
    safe(api.get<Paged<Project>>('/projects?pageSize=100')),
    safe(api.get<LeadSource[]>('/lead-sources')),
    safe(api.get<Paged<User>>('/users?role=SALES&pageSize=100')),
  ]);

  return (
    <div>
      <div className="mb-4">
        <Link href="/dashboard/leads" className="text-sm text-brand-600 hover:underline">
          ← العودة للعملاء
        </Link>
      </div>
      <h1 className="text-2xl font-bold mb-6">عميل محتمل جديد</h1>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-3xl">
        <LeadForm
          projects={projectsRes.data?.data ?? []}
          sources={sourcesRes.data ?? []}
          sales={salesRes.data?.data ?? []}
        />
      </div>
    </div>
  );
}
