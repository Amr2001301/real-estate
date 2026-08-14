import Link from 'next/link';
import { Plus, AlertCircle, Kanban, Upload } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, Lead, LeadStage } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { LeadPipeline } from '@/components/crm/lead-pipeline';
import { PipelineStatsBar } from '@/components/crm/pipeline-stats-bar';
import { LeadsFilterPopover } from '@/components/crm/leads-filter-popover';
import { PremiumPageHero } from '@/components/premium';

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
    <div className="flex flex-col gap-5 lg:gap-6 pb-2">
      <PremiumPageHero
        title="مسار مبيعات العقارات"
        description="نظرة كاملة على فرص المبيعات عبر مراحل البيع. اسحب البطاقات بين المراحل لتحديث الحالة فورًا."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'فرص المبيعات' },
        ]}
        meta={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-2.5 py-1 text-[11px] font-bold text-brand-700">
            <Kanban className="h-3.5 w-3.5" />
            Kanban
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <LeadsFilterPopover defaultStage={sp.stage} defaultQ={sp.q} />
            <Link href={'/dashboard/leads/import' as never}>
              <Button variant="secondary" size="md" leftIcon={<Upload className="h-4 w-4" />}>
                استيراد Excel
              </Button>
            </Link>
            <Link href={'/dashboard/leads/new' as never}>
              <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
                إضافة فرصة جديدة
              </Button>
            </Link>
          </div>
        }
      />

      {leadsRes.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">تعذر تحميل العملاء: {leadsRes.error}</p>
        </div>
      )}

      <PipelineStatsBar totalLeads={totalLeads} wonCount={wonCount} counts={counts} />

      <LeadPipeline leads={leads} counts={counts} />
    </div>
  );
}
