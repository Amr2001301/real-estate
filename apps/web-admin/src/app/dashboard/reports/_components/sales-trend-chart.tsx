import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';

export interface SalesTrendPoint {
  month: number;
  label: string;
  contracts: number;
  total: number;
}

interface Props {
  data: SalesTrendPoint[];
  highlightMonths?: number[];
  className?: string;
}

export function SalesTrendChart({ data, highlightMonths, className }: Props) {
  const maxContracts = Math.max(1, ...data.map((d) => d.contracts));
  const allZero = data.every((d) => d.contracts === 0);
  const highlighted = new Set(highlightMonths ?? []);

  if (allZero) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-8 text-center', className)}>
        <p className="text-sm text-slate-400">لا توجد عقود مسجلة في هذه السنة</p>
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      <div className="h-44 flex items-end gap-1 sm:gap-1.5">
        {data.map((d) => {
          const pct = (d.contracts / maxContracts) * 100;
          const isHighlight = highlighted.has(d.month);
          return (
            <div
              key={d.month}
              className="flex-1 flex flex-col items-center justify-end h-full"
            >
              <div className="w-full flex flex-col items-center justify-end h-full relative group">
                {/* Hover tooltip */}
                <div className="absolute -top-14 start-1/2 -translate-x-1/2 z-10 min-w-[88px] rounded-lg bg-slate-900 px-2.5 py-1.5 text-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg pointer-events-none">
                  <p className="text-2xs font-semibold text-white whitespace-nowrap">{d.contracts} عقد</p>
                  <p className="text-2xs text-slate-300 whitespace-nowrap mt-0.5" dir="ltr">{formatCurrency(d.total)}</p>
                </div>
                <div
                  className={cn(
                    'w-full rounded-t-[3px] transition-all duration-200',
                    d.contracts === 0
                      ? 'bg-slate-100'
                      : isHighlight
                        ? 'bg-brand-500 shadow-sm'
                        : 'bg-brand-200/80 hover:bg-brand-300/80',
                  )}
                  style={{ height: d.contracts === 0 ? '3px' : `${Math.max(pct, 5)}%` }}
                  aria-label={`${d.label}: ${d.contracts} عقد`}
                />
              </div>
            </div>
          );
        })}
      </div>
      {/* Month labels */}
      <div className="mt-2.5 flex items-end gap-1 sm:gap-1.5">
        {data.map((d) => (
          <div
            key={d.month}
            className={cn(
              'flex-1 text-center text-[10px] leading-tight truncate',
              highlighted.has(d.month) ? 'text-brand-700 font-semibold' : 'text-slate-400',
            )}
          >
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}
