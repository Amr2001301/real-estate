import { Sparkles } from 'lucide-react';
import { formatDate } from '@/lib/format';
import type { Locale } from '@/lib/locale';
import { aiT, usageTone, type AiPlanView } from './ai-strings';

export type AiUsage = ({ enabled: true } & AiPlanView) | { enabled: false };

/**
 * The company admin's view of the AI assistant package: questions used this
 * month and when it ends. Nothing is shown when the assistant was never
 * enabled for the company.
 */
export function AiUsageCard({ usage, locale }: { usage: AiUsage | null; locale: Locale }) {
  if (!usage || !usage.enabled) return null;
  const m = aiT(locale);
  const note =
    usage.status === 'ENDED' ? m.usageCardEnded : usage.status === 'EXHAUSTED' ? m.usageCardFull : m.usageCardEnds(formatDate(usage.periodEnd, locale));
  return (
    <section
      aria-label={m.usageCardTitle}
      data-testid="ai-usage-card"
      className="flex flex-wrap items-center gap-4 rounded-[20px] border border-hairline bg-surface px-5 py-4 shadow-soft"
    >
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hairline text-brand-700">
        <Sparkles className="h-4 w-4" />
      </span>
      <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-bold text-slate-900">{m.usageCardTitle}</span>
          {usage.packageName && <span className="text-xs text-slate-500">{usage.packageName}</span>}
          <span className="ms-auto text-sm tabular-nums text-slate-700">{m.usageCardLine(usage.used, usage.quota)}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-sunken">
          <div className={`h-full ${usageTone(usage)}`} style={{ width: `${usage.usedPct}%` }} />
        </div>
        <span className={`text-xs ${usage.status === 'ACTIVE' ? 'text-slate-500' : 'font-semibold text-danger-700'}`}>{note}</span>
      </div>
    </section>
  );
}
