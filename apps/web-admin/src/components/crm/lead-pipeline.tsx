import type { Lead, LeadStage } from '@/lib/types';
import { LeadPipelineBoard } from './lead-pipeline-board';

interface Props {
  leads: Lead[];
  /** Authoritative pipeline counts from /leads/pipeline (full counts, not just current page). */
  counts: Partial<Record<LeadStage, number>>;
}

/** Server-side entry point. Renders the interactive client kanban board. */
export function LeadPipeline({ leads, counts }: Props) {
  return <LeadPipelineBoard initialLeads={leads} counts={counts} />;
}
