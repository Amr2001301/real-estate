import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface PremiumPanelProps {
  title: ReactNode;
  sub?: ReactNode;
  /** A gold "view all"-style link at the end of the header. */
  link?: { href: string; label: string };
  /** Anything else at the end of the header (a pill, a total). */
  trailing?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Padding of the body; "none" for tables / hairline grids that run edge to edge. */
  padding?: 'normal' | 'none';
}

/**
 * The content card of the U5 pages: cream surface, hairline border, a Naskh
 * title with a muted line, and an optional gold link — no coloured icon chip.
 */
export function PremiumPanel({ title, sub, link, trailing, children, className, padding = 'normal' }: PremiumPanelProps) {
  return (
    <section className={cn('flex flex-col overflow-hidden rounded-[22px] border border-hairline bg-surface', className)}>
      <header className="flex items-start justify-between gap-4 px-6 pb-4 pt-5">
        <div className="min-w-0">
          <h2 className="font-heading text-[19px] font-bold leading-snug text-slate-900">{title}</h2>
          {sub && <p className="mt-0.5 text-[13px] text-slate-500">{sub}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {trailing}
          {link && (
            <Link
              href={link.href as never}
              className="inline-flex items-center gap-1 text-[13px] font-bold text-brand-700 hover:text-brand-600"
            >
              {link.label}
              <ArrowLeft className="h-3.5 w-3.5 ltr:rotate-180" aria-hidden />
            </Link>
          )}
        </div>
      </header>
      <div className={cn('flex-1', padding === 'normal' && 'px-6 pb-6')}>{children}</div>
    </section>
  );
}

/** A small muted note for an empty panel, in a dashed box. */
export function PremiumEmptyNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-hairline px-4 py-6 text-center text-[13px] text-slate-500">
      {children}
    </div>
  );
}
