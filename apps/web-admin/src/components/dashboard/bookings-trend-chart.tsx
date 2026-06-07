import { cn } from '@/lib/cn';

export interface BookingsTrendDatum {
  month: string;
  value: number;
  highlight?: boolean;
}

interface Props {
  data: BookingsTrendDatum[];
  className?: string;
}

export function BookingsTrendChart({ data, className }: Props) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className={cn('w-full', className)}>
      <div className="h-56 flex items-end gap-3 sm:gap-4">
        {data.map((d) => {
          const pct = (d.value / max) * 100;
          return (
            <div
              key={d.month}
              className="flex-1 flex flex-col items-center justify-end h-full"
            >
              <div className="w-full flex flex-col items-center justify-end h-full relative group">
                <div
                  className={cn(
                    'w-full rounded-t-lg transition-all',
                    d.highlight
                      ? 'bg-gradient-to-b from-brand-500 to-brand-600 shadow-md'
                      : 'bg-brand-100/60 hover:bg-brand-100 hover:shadow-sm',
                  )}
                  style={{ height: `${Math.max(pct, 4)}%` }}
                  aria-label={`${d.month}: ${d.value}`}
                />
                <div
                  className={cn(
                    'absolute -top-6 px-2 py-0.5 rounded-md text-2xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity',
                    'bg-slate-900 text-white shadow-md',
                  )}
                >
                  {d.value}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-end gap-3 sm:gap-4">
        {data.map((d) => (
          <div key={d.month} className="flex-1 text-center text-2xs text-slate-500">
            {d.month}
          </div>
        ))}
      </div>
    </div>
  );
}
