import type { CashflowTrendPoint } from '@/lib/types';

/**
 * Collected against due, month by month: a muted bar for what fell due and a
 * gold one for what came in, side by side. Plain HTML — server-rendered, its
 * axis labels never collide (the chart runtime's did), and drawn left to
 * right in both languages (time reads that way on a chart). Hovering a month
 * shows its two figures.
 */
export function CashflowChart({
  data,
  labels,
  money,
  short,
}: {
  data: CashflowTrendPoint[];
  labels: { collected: string; due: string };
  /** A full amount ("82,222 ج.م"). */
  money: (n: number) => string;
  /** An axis amount ("1.2 مليون"). */
  short: (n: number) => string;
}) {
  const max = Math.max(0, ...data.flatMap((d) => [d.collected, d.due]));
  const step = niceStep(max / 4);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const pct = (n: number) => `${Math.max(n > 0 ? 1.5 : 0, (n / top) * 100)}%`;

  return (
    <div data-testid="fin-cashflow" dir="ltr" className="grid grid-cols-[auto_1fr] gap-x-3">
      {/* Axis */}
      <div className="relative h-56 w-12">
        {ticks.map((t) => (
          <span
            key={t}
            className="absolute end-0 whitespace-nowrap text-[10.5px] text-slate-400 tabular-nums"
            style={{ bottom: `${(t / top) * 100}%`, transform: 'translateY(50%)' }}
          >
            {t === 0 ? '0' : short(t)}
          </span>
        ))}
      </div>

      {/* Plot */}
      <div className="relative h-56">
        {ticks.map((t) => (
          <span
            key={t}
            className={t === 0 ? 'absolute inset-x-0 border-t border-hairline' : 'absolute inset-x-0 border-t border-dashed border-hairline/70'}
            style={{ bottom: `${(t / top) * 100}%` }}
          />
        ))}
        <div className="absolute inset-0 flex items-end">
          {data.map((d, i) => (
            <div
              key={d.month}
              data-testid="fin-cashflow-month"
              className="group relative flex h-full flex-1 items-end justify-center gap-1 rounded-t-lg transition-colors hover:bg-brand-500/[0.05]"
            >
              <span className="w-[22%] max-w-[18px] rounded-t-md bg-slate-400/35" style={{ height: pct(d.due) }} />
              <span
                className="w-[22%] max-w-[18px] rounded-t-md bg-gradient-to-t from-brand-600 to-brand-400 shadow-[0_0_18px_-4px] shadow-brand-500/50"
                style={{ height: pct(d.collected) }}
              />
              {/* Hover card */}
              <div
                className={
                  'pointer-events-none absolute bottom-full z-10 mb-2 hidden min-w-[150px] rounded-xl border border-hairline bg-surface px-3 py-2.5 text-[11.5px] shadow-lg group-hover:block ' +
                  (i < data.length / 2 ? 'start-1/2' : 'end-1/2')
                }
              >
                <p className="mb-1.5 font-bold text-slate-900">{d.label}</p>
                <p className="flex items-center justify-between gap-3 text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-brand-500" />
                    {labels.collected}
                  </span>
                  <b className="text-slate-900 tabular-nums">{money(d.collected)}</b>
                </p>
                <p className="mt-1 flex items-center justify-between gap-3 text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-slate-400/60" />
                    {labels.due}
                  </span>
                  <b className="text-slate-900 tabular-nums">{money(d.due)}</b>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Months */}
      <span />
      <div className="mt-2 flex">
        {data.map((d) => (
          <span key={d.month} className="flex-1 truncate text-center text-[11.5px] font-medium text-slate-500">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A round axis step: 1, 2, 2.5 or 5 × a power of ten. */
function niceStep(raw: number): number {
  if (!(raw > 0)) return 1;
  const exp = 10 ** Math.floor(Math.log10(raw));
  const f = raw / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * exp;
}
