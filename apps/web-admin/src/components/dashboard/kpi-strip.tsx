import type { ReactNode } from 'react';

export interface KpiStripItem {
  label: string;
  value: ReactNode;
  sub?:  string;
}

interface Props {
  items: KpiStripItem[];
}

const GOLD_BAR = { background: 'linear-gradient(to left, #b8923e, #e6c46a, #b8923e)' } as const;

export function KpiStrip({ items }: Props) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {items.map((k) => (
        <div key={k.label} className="relative overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xs">
          <div className="h-[3px] w-full shrink-0" style={GOLD_BAR} />
          <div className="px-3 py-3 text-center">
            <p className="text-xl font-extrabold tabular-nums leading-none text-slate-900">{k.value}</p>
            {k.sub && (
              <p className="mt-0.5 truncate text-[9px] leading-none text-slate-400">{k.sub}</p>
            )}
            <p className="mt-1 truncate text-[9px] font-bold uppercase tracking-wide leading-none text-slate-400">
              {k.label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
