import type { Route } from 'next';
import Link from 'next/link';
import { ArrowLeft, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

interface RecentRowProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  /** When set, the whole row becomes a link and a hover chevron appears. */
  href?: string;
}

/**
 * Borderless activity row — designed to sit inside a `RecentPanel`, so a stack
 * reads as one calm grouped list rather than a wall of identical boxes. A soft
 * surface tint appears on hover; the trailing slot (status / amount) keeps
 * visual priority.
 */
export function RecentRow({ icon: Icon, title, subtitle, trailing, href }: RecentRowProps) {
  const inner = (
    <>
      <span
        className={cn(
          'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-100 text-gold-600 transition-colors',
          href && 'group-hover:bg-gold-200',
        )}
      >
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-semibold text-ink-strong">{title}</p>
        {subtitle && <p className="mt-0.5 line-clamp-1 text-xs text-ink-muted">{subtitle}</p>}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
      {href && (
        <ArrowLeft
          className="h-4 w-4 shrink-0 -translate-x-1 text-gold-500 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
          aria-hidden
        />
      )}
    </>
  );

  const base = 'flex items-center gap-3.5 px-3 py-4';

  if (href) {
    return (
      <Link href={href as Route} className={cn(base, 'group -mx-1 rounded-xl px-4 transition-colors duration-200 hover:bg-surface-soft')}>
        {inner}
      </Link>
    );
  }

  return <div className={base}>{inner}</div>;
}
