import Link from 'next/link';
import { ArrowUpRight, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Open-lead stages, in journey order, with the colours the lead page uses. */
const STAGES = [
  { stage: 'NEW',         bar: 'bg-slate-400',   value: 'text-slate-700'  },
  { stage: 'INTERESTED',  bar: 'bg-sky-400',     value: 'text-sky-600'    },
  { stage: 'VISIT',       bar: 'bg-violet-400',  value: 'text-violet-600' },
  { stage: 'NEGOTIATION', bar: 'bg-amber-400',   value: 'text-amber-600'  },
] as const;

/**
 * Where the open leads sit right now: one card per stage (count and share of
 * the open leads) over a proportion bar. Shared by the sales and manager homes.
 */
export function StagePipeline({
  title,
  sub,
  labels,
  counts,
  link,
  emptyNote,
  className,
}: {
  title: string;
  sub: string;
  labels: Record<string, string>;
  counts: Record<string, number>;
  link?: { href: string; label: string };
  emptyNote: string;
  className?: string;
}) {
  const items = STAGES.map((s) => ({ ...s, label: labels[s.stage] ?? s.stage, count: counts[s.stage] ?? 0 }));
  const total = items.reduce((a, s) => a + s.count, 0);

  return (
    <section data-testid="stage-pipeline" className={cn('flex flex-col overflow-hidden rounded-[22px] border border-hairline bg-surface', className)}>
      <header className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand-500/40 text-brand-700">
            <TrendingUp className="h-4 w-4" />
          </span>
          <div>
            <h3 className="font-heading text-[18px] font-bold leading-snug text-slate-900">{title}</h3>
            <p className="mt-0.5 text-[12px] text-slate-500">{sub}</p>
          </div>
        </div>
        {link && (
          <Link href={link.href as never} className="inline-flex items-center gap-1 text-[13px] font-bold text-brand-700 hover:text-brand-600">
            {link.label}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </header>

      <div className="flex flex-1 flex-col justify-center gap-4 p-5">
        {total === 0 ? (
          <p className="rounded-2xl border border-dashed border-hairline px-4 py-6 text-center text-[13px] text-slate-500">{emptyNote}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {items.map((s) => {
                const pct = Math.round((s.count / total) * 100);
                return (
                  <Link
                    key={s.stage}
                    href={`/dashboard/leads?stage=${s.stage}` as never}
                    className={cn(
                      'relative overflow-hidden rounded-2xl border border-hairline bg-surface-muted/30 px-4 py-3.5 transition-colors hover:border-brand-500/40',
                      s.count === 0 && 'opacity-50',
                    )}
                  >
                    <span className={cn('absolute inset-x-0 top-0 h-[3px]', s.bar)} />
                    <p className="text-[12px] font-semibold text-slate-500">{s.label}</p>
                    <p className={cn('mt-1.5 text-[28px] font-bold leading-none tabular-nums', s.value)}>{s.count}</p>
                    <p className="mt-1.5 text-[11px] tabular-nums text-slate-500">{pct}%</p>
                  </Link>
                );
              })}
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-surface-muted" dir="ltr">
              {items.filter((s) => s.count > 0).map((s) => (
                <div key={s.stage} className={cn('h-full', s.bar)} style={{ width: `${(s.count / total) * 100}%` }} />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
