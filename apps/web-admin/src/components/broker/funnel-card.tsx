import { UserPlus, ShieldCheck, BookmarkCheck, FileText, FilePen, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import type { BrokerReportsSummary } from '@/lib/types';

interface Props {
  summary: BrokerReportsSummary;
  title?: string;
}

const STAGE_DEFS: Array<{
  key: keyof BrokerReportsSummary;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  bar: string;
}> = [
  { key: 'leadsSubmitted', label: 'فرص مُرسلة', icon: UserPlus, bar: 'bg-brand-500' },
  { key: 'leadsApproved', label: 'فرص معتمدة', icon: ShieldCheck, bar: 'bg-info-500' },
  { key: 'reservationsCreated', label: 'حجوزات', icon: BookmarkCheck, bar: 'bg-accent-500' },
  { key: 'contractsCreated', label: 'عقود', icon: FilePen, bar: 'bg-amber-500' },
  { key: 'contractsSigned', label: 'عقود موقّعة', icon: FileText, bar: 'bg-emerald-500' },
  { key: 'payoutsPaid', label: 'دفعات مدفوعة', icon: Wallet, bar: 'bg-success-600' },
];

function pct(num: number, denom: number): string {
  if (denom <= 0) return '—';
  return `${((num / denom) * 100).toFixed(1)}%`;
}

export function FunnelCard({ summary, title = 'قمع التحويل' }: Props) {
  const stages = STAGE_DEFS.map((s) => ({
    ...s,
    value: Number(summary[s.key] ?? 0),
  }));
  const top = Math.max(stages[0]?.value ?? 0, 1);

  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-slate-900 mb-4">{title}</h2>
      <ul className="space-y-2.5">
        {stages.map((s, idx) => {
          const prev = idx === 0 ? null : (stages[idx - 1]?.value ?? 0);
          const widthPct = Math.max((s.value / top) * 100, 4);
          const Icon = s.icon;
          return (
            <li key={s.key} className="flex items-center gap-3">
              <div className="w-32 shrink-0 flex items-center gap-2 text-xs text-slate-700">
                <Icon className="h-3.5 w-3.5 text-slate-500" />
                <span className="truncate">{s.label}</span>
              </div>
              <div className="flex-1 h-7 rounded-md bg-surface-muted overflow-hidden relative">
                <div
                  className={cn('h-full transition-all', s.bar)}
                  style={{ width: `${widthPct}%` }}
                />
                <span className="absolute inset-0 flex items-center px-2 text-xs font-semibold tabular-nums text-slate-900">
                  {s.value.toLocaleString()}
                </span>
              </div>
              <div className="w-16 shrink-0 text-end text-2xs text-slate-500 tabular-nums">
                {prev !== null ? pct(s.value, prev) : '—'}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-2xs text-slate-500 mt-3">
        النسبة المئوية لكل مرحلة محسوبة بالنسبة للمرحلة السابقة.
      </p>
    </Card>
  );
}
