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
      className="flex flex-wrap items-center gap-4 rounded-[22px] border border-hairline bg-surface px-6 py-5 shadow-[0_1px_2px_rgb(11_18_32/0.04),0_10px_30px_-10px_rgb(11_18_32/0.08)] dark:shadow-none"
    >
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,#EAD5A3_0%,#C8A24B_48%,#9E7A2B_100%)] text-[#0B1220]">
        <Sparkles className="h-5 w-5" strokeWidth={2} />
      </span>
      <div className="flex min-w-[220px] flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <span className="font-heading text-[17px] font-semibold text-slate-900">{m.usageCardTitle}</span>
          {usage.packageName && <span className="text-xs text-slate-500">{usage.packageName}</span>}
          <span className="ms-auto text-[13px] tabular-nums text-slate-600">{m.usageCardLine(usage.used, usage.quota)}</span>
        </div>
        <div className="h-[7px] overflow-hidden rounded-full bg-surface-sunken">
          <div className={`h-full rounded-full ${usage.status === 'ACTIVE' && usage.usedPct < 80 ? 'bg-[linear-gradient(135deg,#EAD5A3_0%,#C8A24B_48%,#9E7A2B_100%)]' : usageTone(usage)}`} style={{ width: `${usage.usedPct}%` }} />
        </div>
        <span className={`text-xs ${usage.status === 'ACTIVE' ? 'text-slate-500' : 'font-semibold text-danger-700'}`}>{note}</span>
      </div>
    </section>
  );
}
