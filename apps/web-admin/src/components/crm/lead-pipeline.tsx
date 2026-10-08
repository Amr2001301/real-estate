import type { Lead, LeadStage } from '@/lib/types';
import type { Locale } from '@/lib/locale';
import { LeadPipelineBoard } from './lead-pipeline-board';

interface Props {
  leads: Lead[];
  /** Authoritative pipeline counts from /leads/pipeline (full counts, not just current page). */
  counts: Partial<Record<LeadStage, number>>;
  locale?: Locale;
}

/** Server-side entry point. Renders the interactive client kanban board. */
export function LeadPipeline({ leads, counts, locale = 'ar' }: Props) {
  return <LeadPipelineBoard initialLeads={leads} counts={counts} locale={locale} />;
}
