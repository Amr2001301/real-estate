import { UserPlus, ShieldCheck, BookmarkCheck, FileText, FilePen, Wallet, ChevronLeft } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import type { BrokerReportsSummary } from '@/lib/types';

interface Props {
  summary: BrokerReportsSummary;
  title?: string;
}

const STAGE_DEFS: Array<{
  key:    keyof BrokerReportsSummary;
  label:  string;
  icon:   React.ComponentType<{ className?: string }>;
  color:  string;
  bg:     string;
  bar:    string;
}> = [
  { key: 'leadsSubmitted',    label: 'فرص مُرسلة',    icon: UserPlus,     color: 'text-brand-700',   bg: 'bg-brand-50',   bar: 'from-brand-400 to-brand-600'   },
  { key: 'leadsApproved',     label: 'فرص معتمدة',    icon: ShieldCheck,  color: 'text-blue-700',    bg: 'bg-blue-50',    bar: 'from-blue-400 to-blue-600'     },
  { key: 'reservationsCreated', label: 'حجوزات',      icon: BookmarkCheck,color: 'text-violet-700',  bg: 'bg-violet-50',  bar: 'from-violet-400 to-violet-600' },
  { key: 'contractsCreated',  label: 'عقود',          icon: FilePen,      color: 'text-amber-700',   bg: 'bg-amber-50',   bar: 'from-amber-400 to-amber-600'   },
  { key: 'contractsSigned',   label: 'عقود موقّعة',   icon: FileText,     color: 'text-emerald-700', bg: 'bg-emerald-50', bar: 'from-emerald-400 to-emerald-600'},
  { key: 'payoutsPaid',       label: 'دفعات مدفوعة',  icon: Wallet,       color: 'text-teal-700',    bg: 'bg-teal-50',    bar: 'from-teal-400 to-teal-600'     },
];

function pct(num: number, denom: number): string | null {
  if (denom <= 0) return null;
  return `${((num / denom) * 100).toFixed(1)}%`;
}

export function FunnelCard({ summary, title = 'قمع التحويل' }: Props) {
  const stages = STAGE_DEFS.map((s) => ({
    ...s,
    value: Number(summary[s.key] ?? 0),
  }));
  const top = Math.max(stages[0]?.value ?? 0, 1);

  return (
    <Card className="p-5 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        <span className="text-2xs text-slate-500 bg-slate-100 rounded-full px-2 py-0.5 font-medium">
          {stages.length} مراحل
        </span>
      </div>

      {/* Stage rows */}
      <div className="space-y-1 flex-1">
        {stages.map((s, idx) => {
          const prev    = idx === 0 ? null : (stages[idx - 1]?.value ?? 0);
          const widthPct = Math.max((s.value / top) * 100, 3);
          const convRate = prev !== null ? pct(s.value, prev) : null;
          const Icon    = s.icon;

          return (
            <div key={s.key}>
              {/* Connector arrow between stages */}
              {idx > 0 && (
                <div className="flex items-center gap-2 ps-10 mb-1">
                  <div className="flex-1 h-px bg-slate-100" />
                  {convRate && (
                    <span className="inline-flex items-center gap-0.5 text-2xs font-semibold text-slate-500 shrink-0">
                      <ChevronLeft className="h-3 w-3 rotate-90" />
                      {convRate}
                    </span>
                  )}
                  <div className="flex-1 h-px bg-slate-100" />
                </div>
              )}

              {/* Stage row */}
              <div className="flex items-center gap-3 group">
                {/* Icon pill */}
                <div className={cn('h-8 w-8 rounded-xl flex items-center justify-center shrink-0', s.bg)}>
                  <Icon className={cn('h-3.5 w-3.5', s.color)} />
                </div>

                {/* Bar + label */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-700 font-semibold">{s.label}</span>
                    <span className="text-xs font-bold tabular-nums text-slate-900 ms-2">
                      {s.value.toLocaleString('ar-EG')}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full bg-gradient-to-l transition-all', s.bar)}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <p className="text-2xs text-slate-500 mt-4 pt-3 border-t border-hairline">
        نسبة التحويل محسوبة بالنسبة للمرحلة السابقة مباشرة.
      </p>
    </Card>
  );
}
