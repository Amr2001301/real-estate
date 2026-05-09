import Link from 'next/link';
import { api, safe } from '@/lib/api';
import type { Paged, Lead, LeadStage } from '@/lib/types';
import { formatDate, tx } from '@/lib/format';
import { DataTable } from '@/components/table';
import { LeadStageBadge } from '@/components/badges';

const STAGES: LeadStage[] = ['NEW', 'INTERESTED', 'VISIT', 'NEGOTIATION', 'WON', 'LOST'];
const STAGE_LABELS: Record<LeadStage, string> = {
  NEW: 'جديد',
  INTERESTED: 'مهتم',
  VISIT: 'زيارة',
  NEGOTIATION: 'تفاوض',
  WON: 'فوز',
  LOST: 'خسارة',
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams({ pageSize: '50' });
  if (sp.stage) qs.set('stage', sp.stage);
  if (sp.q) qs.set('q', sp.q);

  const [leadsRes, pipelineRes] = await Promise.all([
    safe(api.get<Paged<Lead>>(`/leads?${qs}`)),
    safe(api.get<Record<LeadStage, number>>('/leads/pipeline')),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">العملاء المحتملون (CRM)</h1>
        <Link
          href="/dashboard/leads/new"
          className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm hover:bg-brand-700"
        >
          + عميل محتمل جديد
        </Link>
      </div>

      {pipelineRes.data && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-6">
          {STAGES.map((s) => (
            <Link
              key={s}
              href={`/dashboard/leads?stage=${s}`}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 text-center hover:shadow-md transition"
            >
              <div className="text-xs text-gray-500">{STAGE_LABELS[s]}</div>
              <div className="text-2xl font-bold mt-1">{pipelineRes.data[s] ?? 0}</div>
            </Link>
          ))}
        </div>
      )}

      <form className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-gray-500 mb-1">بحث (اسم / هاتف / بريد)</label>
          <input
            name="q"
            defaultValue={sp.q}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">المرحلة</label>
          <select
            name="stage"
            defaultValue={sp.stage ?? ''}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">الكل</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <button className="rounded-lg bg-gray-800 text-white px-4 py-2 text-sm">تصفية</button>
      </form>

      {leadsRes.error && (
        <div className="rounded-lg bg-red-50 text-red-700 p-4 mb-4 text-sm">{leadsRes.error}</div>
      )}

      {leadsRes.data && (
        <DataTable
          rowKey={(l) => l.id}
          rows={leadsRes.data.data}
          emptyMessage="لا يوجد عملاء محتملون بعد"
          columns={[
            { key: 'name', header: 'الاسم', cell: (l) => <span className="font-medium">{l.fullName}</span> },
            { key: 'phone', header: 'الهاتف', cell: (l) => <span dir="ltr" className="font-mono text-xs">{l.phone}</span> },
            { key: 'project', header: 'المشروع', cell: (l) => tx(l.projectInterest?.name) },
            { key: 'sales', header: 'مندوب المبيعات', cell: (l) => l.assignedSales?.fullName ?? '—' },
            { key: 'stage', header: 'المرحلة', cell: (l) => <LeadStageBadge stage={l.stage} /> },
            { key: 'createdAt', header: 'تاريخ', cell: (l) => <span className="text-gray-500">{formatDate(l.createdAt)}</span> },
            {
              key: 'actions',
              header: '',
              cell: (l) => (
                <Link href={`/dashboard/leads/${l.id}`} className="text-brand-600 hover:underline text-sm">
                  عرض
                </Link>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
