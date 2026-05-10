import Link from 'next/link';
import { Plus, AlertCircle } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, Lead, LeadStage } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { LeadPipeline } from '@/components/crm/lead-pipeline';
import { PipelineStatsBar } from '@/components/crm/pipeline-stats-bar';
import { LeadsFilterPopover } from '@/components/crm/leads-filter-popover';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams({ pageSize: '200' });
  if (sp.stage) qs.set('stage', sp.stage);
  if (sp.q) qs.set('q', sp.q);

  const [leadsRes, pipelineRes] = await Promise.all([
    safe(api.get<Paged<Lead>>(`/leads?${qs.toString()}`)),
    safe(api.get<Record<LeadStage, number>>('/leads/pipeline')),
  ]);

  const leads = leadsRes.data?.data ?? [];
  const counts: Partial<Record<LeadStage, number>> = pipelineRes.data ?? {};
  const totalLeads = Object.values(counts).reduce<number>(
    (sum, n) => sum + (typeof n === 'number' ? n : 0),
    0,
  );
  const wonCount = counts.WON ?? 0;

  return (
    <div className="space-y-6 lg:space-y-8 pb-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <nav aria-label="breadcrumb" className="mb-2">
            <ol className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              <li>
                <Link
                  href={'/dashboard' as never}
                  className="hover:text-slate-900 transition-colors"
                >
                  لوحة التحكم
                </Link>
              </li>
              <li aria-hidden className="text-slate-300">⁄</li>
              <li className="text-slate-700 font-medium">العملاء المحتملون</li>
            </ol>
          </nav>
          <p className="text-2xs font-bold uppercase tracking-[0.18em] text-brand-600 mb-1.5">
            Enterprise CRM
          </p>
          <h1 className="text-2xl sm:text-[32px] font-bold tracking-tight text-slate-900 leading-tight">
            مسار مبيعات العقارات
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 max-w-2xl">
            نظرة كاملة على دورة حياة العملاء المحتملين عبر مراحل البيع. اسحب البطاقات بين المراحل لتحديث الحالة فوراً.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <LeadsFilterPopover defaultStage={sp.stage} defaultQ={sp.q} />
          <Link href={'/dashboard/leads/new' as never}>
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              إضافة عميل جديد
            </Button>
          </Link>
        </div>
      </div>

      {leadsRes.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">تعذر تحميل العملاء: {leadsRes.error}</p>
        </div>
      )}

      <LeadPipeline leads={leads} counts={counts} />

      <PipelineStatsBar totalLeads={totalLeads} wonCount={wonCount} />
    </div>
  );
}
