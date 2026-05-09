import Link from 'next/link';
import { api, safe } from '@/lib/api';
import type { Lead, Paged, User, LeadStage } from '@/lib/types';
import { formatDateTime, tx } from '@/lib/format';
import { LeadStageBadge } from '@/components/badges';
import { addNoteAction, assignLeadAction } from '../actions';
import { StageButtons } from './stage-buttons';

interface LeadDetail extends Lead {
  activities?: Array<{ id: string; type: string; payload: unknown; createdAt: string }>;
}

const STAGES: LeadStage[] = ['NEW', 'INTERESTED', 'VISIT', 'NEGOTIATION', 'WON', 'LOST'];

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [leadRes, salesRes] = await Promise.all([
    safe(api.get<LeadDetail>(`/leads/${id}`)),
    safe(api.get<Paged<User>>('/users?role=SALES&pageSize=100')),
  ]);

  if (leadRes.error) {
    return <div className="rounded-lg bg-red-50 text-red-700 p-4 text-sm">{leadRes.error}</div>;
  }
  const lead = leadRes.data!;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/leads" className="text-sm text-brand-600 hover:underline">
          ← العملاء المحتملون
        </Link>
        <h1 className="text-2xl font-bold mt-1 flex items-center gap-3">
          {lead.fullName}
          <LeadStageBadge stage={lead.stage} />
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          <span dir="ltr" className="font-mono">{lead.phone}</span>
          {lead.email && <> · {lead.email}</>}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-lg font-bold mb-3">تغيير المرحلة</h2>
            <StageButtons leadId={lead.id} currentStage={lead.stage} stages={STAGES} />
          </section>

          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-lg font-bold mb-3">الملاحظات</h2>

            <form action={addNoteAction.bind(null, lead.id)} className="mb-4">
              <textarea
                name="body"
                required
                rows={2}
                placeholder="أضف ملاحظة…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <button className="mt-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 text-sm">
                حفظ الملاحظة
              </button>
            </form>

            <ul className="space-y-3">
              {(lead.notes ?? []).length === 0 && (
                <li className="text-xs text-gray-400">لا توجد ملاحظات بعد</li>
              )}
              {lead.notes?.map((n) => (
                <li key={n.id} className="border-r-2 border-brand-500 pr-3">
                  <p className="text-sm">{n.body}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {n.sales?.fullName ?? '—'} · {formatDateTime(n.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-lg font-bold mb-3">السجل الزمني</h2>
            <ul className="space-y-2 text-sm">
              {(lead.activities ?? []).length === 0 && (
                <li className="text-xs text-gray-400">لا يوجد نشاط</li>
              )}
              {lead.activities?.map((a) => (
                <li key={a.id} className="flex justify-between text-xs">
                  <span className="font-mono text-brand-700">{a.type}</span>
                  <span className="text-gray-400">{formatDateTime(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-lg font-bold mb-3">الإسناد</h2>
            <p className="text-sm mb-3">
              مندوب المبيعات الحالي:{' '}
              <span className="font-medium">{lead.assignedSales?.fullName ?? '— غير مسند —'}</span>
            </p>
            <form action={assignLeadAction.bind(null, lead.id)} className="space-y-2">
              <select
                name="assignedSalesId"
                defaultValue={lead.assignedSalesId ?? ''}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">— اختر —</option>
                {salesRes.data?.data.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                  </option>
                ))}
              </select>
              <button className="w-full rounded-lg bg-gray-800 text-white px-3 py-1.5 text-sm">
                تحديث الإسناد
              </button>
            </form>
          </section>

          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-lg font-bold mb-3">معلومات</h2>
            <dl className="text-sm space-y-2">
              <Row k="المشروع المهتم">{tx(lead.projectInterest?.name)}</Row>
              <Row k="المصدر">{tx(lead.source?.name)}</Row>
              <Row k="تاريخ الإنشاء">{formatDateTime(lead.createdAt)}</Row>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-gray-500">{k}</dt>
      <dd className="text-gray-900 text-left">{children}</dd>
    </div>
  );
}
