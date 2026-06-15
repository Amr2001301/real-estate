import type { ReactNode } from 'react';

export interface KpiStripItem {
  label: string;
  value: ReactNode;
  sub?:  string;
}

interface Props {
  items: KpiStripItem[];
}

export function KpiStrip({ items }: Props) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-px bg-hairline rounded-2xl border border-hairline shadow-xs overflow-hidden">
      {items.map((k) => (
        <div key={k.label} className="bg-white px-3 py-3 text-center">
          <p className="text-xl font-extrabold text-slate-900 tabular-nums leading-none">{k.value}</p>
          {k.sub && (
            <p className="text-[9px] text-slate-400 mt-0.5 leading-none truncate">{k.sub}</p>
          )}
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide mt-1 leading-none truncate">
            {k.label}
          </p>
        </div>
      ))}
    </div>
  );
}
