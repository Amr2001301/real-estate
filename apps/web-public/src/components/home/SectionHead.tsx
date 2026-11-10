import Link from 'next/link';
import type { Route } from 'next';
import { cn } from '@/lib/cn';

/**
 * A homepage section heading: a short accent eyebrow, the title and one line
 * under it, with an optional «view all» button at the far end.
 */
export function SectionHead({
  eyebrow,
  title,
  sub,
  action,
  center = false,
  className,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  action?: { href: string; label: string };
  center?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mb-9 flex flex-col gap-5 sm:mb-11',
        center ? 'items-center text-center' : 'sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className={cn('max-w-2xl', center && 'mx-auto')}>
        {eyebrow && (
          <span className="inline-flex items-center gap-2.5 text-[13px] font-semibold text-gold-700 dark:text-gold-300">
            <span className="h-0.5 w-7 rounded-full bg-gold-400" aria-hidden />
            {eyebrow}
            {center && <span className="h-0.5 w-7 rounded-full bg-gold-400" aria-hidden />}
          </span>
        )}
        <h2 className="mt-3 text-[2rem] font-semibold leading-[1.4] text-ink-strong sm:text-[2.5rem]">{title}</h2>
        {sub && <p className="mt-2.5 text-[17px] leading-[1.9] text-ink-muted">{sub}</p>}
      </div>
      {action && (
        <Link
          href={action.href as Route}
          className="inline-flex h-12 shrink-0 items-center justify-center rounded-2xl border border-hairline px-6 text-[15px] font-semibold text-ink-strong transition-colors hover:border-navy/40 hover:text-navy dark:hover:text-gold-300"
        >
          {action.label} ←
        </Link>
      )}
    </div>
  );
}
