import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Table pieces for the U5 look. The navy header row itself comes from
 * globals.css (every `<thead>` in the app); these add the card, the row
 * styles and the cells the mockups repeat.
 */

/** The rounded card around a table, with horizontal scroll on small screens. */
export function PremiumTableCard({ children, footer, className }: { children: ReactNode; footer?: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-[22px] border border-hairline bg-surface', className)}>
      <div className="overflow-x-auto scrollbar-thin">{children}</div>
      {footer && <div className="border-t border-hairline">{footer}</div>}
    </div>
  );
}

/** Row classes: hairline divider, a soft hover. */
export const PREMIUM_ROW = 'border-t border-hairline transition-colors duration-100 hover:bg-surface-muted';

/** A row title: Naskh, with an optional muted code underneath. */
export function RowTitle({ title, href, code, icon }: { title: ReactNode; href?: string; code?: ReactNode; icon?: ReactNode }) {
  const name = href ? (
    <Link href={href as never} className="hover:text-brand-700 transition-colors">
      {title}
    </Link>
  ) : (
    title
  );
  return (
    <div className="flex items-center gap-4">
      {icon}
      <div className="min-w-0">
        <p className="font-heading text-[16px] font-bold leading-snug text-slate-900">{name}</p>
        {code && <p className="mt-0.5 font-mono text-[12px] text-slate-500" dir="ltr">{code}</p>}
      </div>
    </div>
  );
}

/** The navy tile with a thin gold icon at the start of a row. */
export function RowIconTile({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-navy-band text-[#D8B66A] [&_svg]:h-5 [&_svg]:w-5 [&_svg]:stroke-[1.6]">
      {children}
    </span>
  );
}

/** A number in Cormorant with its unit in small gold text. */
export function NumCell({ value, unit, className }: { value: ReactNode; unit?: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-baseline gap-1 whitespace-nowrap', className)}>
      <span className="num text-[22px] font-semibold text-slate-900">{value}</span>
      {unit && <span className="text-[12px] font-bold text-brand-700">{unit}</span>}
    </span>
  );
}

/** The round chevron button that opens a row. */
export function RowOpenButton({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href as never}
      aria-label={label}
      title={label}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-surface text-slate-700 transition-colors hover:border-brand-400/60 hover:text-brand-700"
    >
      <ChevronLeft className="h-4 w-4 ltr:rotate-180" aria-hidden />
    </Link>
  );
}

export interface UnitCounts {
  sold: number;
  reserved: number;
  available: number;
}

/**
 * Sold / reserved / available as one segmented bar (the one unit-status
 * palette), with an optional legend line under it.
 */
export function UnitsBar({
  counts,
  labels,
  showLegend = true,
  emptyLabel,
  className,
}: {
  counts: UnitCounts;
  labels: { sold: string; reserved: string; available: string };
  showLegend?: boolean;
  emptyLabel?: string;
  className?: string;
}) {
  const total = counts.sold + counts.reserved + counts.available;
  if (total === 0 && emptyLabel) return <span className="text-[13px] text-slate-500">{emptyLabel}</span>;
  const parts = [
    { key: 'sold', n: counts.sold, cls: 'bg-unit-sold' },
    { key: 'reserved', n: counts.reserved, cls: 'bg-unit-reserved' },
    { key: 'available', n: counts.available, cls: 'bg-unit-available/60' },
  ] as const;
  return (
    <div className={cn('min-w-[180px]', className)}>
      <div
        className="flex h-2 gap-1"
        role="img"
        aria-label={`${counts.sold} ${labels.sold}، ${counts.reserved} ${labels.reserved}، ${counts.available} ${labels.available}`}
      >
        {parts.map((p) =>
          p.n > 0 ? (
            <span key={p.key} className={cn('rounded-full', p.cls)} style={{ flexGrow: p.n, flexBasis: 0 }} />
          ) : null,
        )}
        {total === 0 && <span className="flex-1 rounded-full bg-surface-sunken" />}
      </div>
      {showLegend && (
        <p className="mt-1.5 text-[12.5px] text-slate-500">
          {counts.sold} {labels.sold} · {counts.reserved} {labels.reserved} · {counts.available} {labels.available}
        </p>
      )}
    </div>
  );
}

/** A status pill with a dot (outlined, as in the mockups). */
export function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: 'success' | 'warning' | 'danger' | 'neutral' | 'gold' }) {
  const TONE = {
    success: 'text-success-700 border-success-600/30 [&>i]:bg-success-600',
    warning: 'text-warning-700 border-warning-600/30 [&>i]:bg-warning-600',
    danger: 'text-danger-700 border-danger-600/30 [&>i]:bg-danger-600',
    gold: 'text-brand-700 border-brand-400/50 [&>i]:bg-brand-500',
    neutral: 'text-slate-600 border-hairline [&>i]:bg-slate-400',
  } as const;
  return (
    <span className={cn('inline-flex items-center gap-2 whitespace-nowrap rounded-full border bg-surface px-3.5 py-1.5 text-[13px] font-bold', TONE[tone])}>
      <i aria-hidden className="h-1.5 w-1.5 rounded-full" />
      {label}
    </span>
  );
}
