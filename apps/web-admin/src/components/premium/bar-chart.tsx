import { cn } from '@/lib/cn';

export interface BarDatum {
  label: string;
  value: number;
}

/**
 * Gold bars with the value above each (U5) — for small counts per period,
 * where a smoothed line would suggest values between the points. Highlighted
 * bars (the current period) get their label in gold and an outlined bar when
 * empty.
 */
export function PremiumBars({
  data,
  highlight = [],
  height = 220,
  className,
}: {
  data: BarDatum[];
  /** Indexes into `data`. */
  highlight?: number[];
  height?: number;
  className?: string;
}) {
  const max = Math.max(0, ...data.map((d) => d.value));
  return (
    <div className={className}>
      <div
        className="flex items-end gap-2 border-b border-hairline sm:gap-3"
        style={{ height }}
        role="img"
        aria-label={data.map((d) => `${d.label} ${d.value}`).join('، ')}
      >
        {data.map((d, i) => {
          const on = highlight.includes(i);
          return (
            <div key={`${d.label}-${i}`} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              {d.value > 0 && <span className="num text-[18px] font-semibold text-slate-900">{d.value}</span>}
              <span
                className={cn(
                  'w-full max-w-[44px] rounded-t-xl',
                  d.value > 0
                    ? 'bg-gradient-to-b from-[#D8B66A] to-[#B38B3A]'
                    : on
                      ? 'border-2 border-b-0 border-[#C79A3B] bg-transparent'
                      : 'bg-surface-sunken',
                )}
                style={{ height: d.value > 0 && max > 0 ? `${Math.max(6, (d.value / max) * 82)}%` : on ? '8px' : '4px' }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2 sm:gap-3">
        {data.map((d, i) => (
          <span
            key={`${d.label}-${i}`}
            className={cn('flex-1 truncate text-center text-[12px]', highlight.includes(i) ? 'font-bold text-brand-700' : 'text-slate-500')}
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
