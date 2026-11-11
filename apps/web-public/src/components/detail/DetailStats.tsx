import type { ReactNode } from 'react';

/** The key figures in one strip, overlapping the hero's foot. */
export function DetailStats({ items }: { items: { label: string; value: ReactNode; sub?: ReactNode; testId?: string }[] }) {
  const cols = ['', 'sm:grid-cols-1', 'sm:grid-cols-2', 'sm:grid-cols-3', 'sm:grid-cols-4', 'sm:grid-cols-5'][Math.min(items.length, 5)];
  return (
    <div className="relative z-10 mt-4 lg:hidden">
      <dl className={`grid grid-cols-2 gap-px overflow-hidden rounded-[1.25rem] border border-hairline bg-hairline shadow-[0_24px_50px_-28px_rgba(0,0,0,0.35)] ${cols}`}>
        {items.map((s) => (
          <div key={s.label} className="bg-surface px-4 py-3.5 sm:px-5" data-testid={s.testId}>
            <dt className="text-[13px] font-medium text-ink-muted">{s.label}</dt>
            <dd className="mt-1 whitespace-nowrap font-display text-[1.15rem] font-semibold leading-tight text-ink-strong">{s.value}</dd>
            {s.sub && <dd className="mt-1 text-[13px] text-ink-muted">{s.sub}</dd>}
          </div>
        ))}
        {items.length % 2 === 1 && <div className="bg-surface sm:hidden" aria-hidden />}
      </dl>
    </div>
  );
}

/** A section heading inside a detail page: accent eyebrow, then the title. */
export function DetailHead({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        <span className="inline-flex items-center gap-2.5 text-[13px] font-semibold text-gold-700 dark:text-gold-300">
          <span className="h-0.5 w-7 rounded-full bg-gold-400" aria-hidden />
          {eyebrow}
        </span>
        <h2 className="mt-1.5 text-[1.3rem] font-semibold leading-[1.4] text-ink-strong sm:text-[1.55rem]">{title}</h2>
      </div>
      {action}
    </div>
  );
}
