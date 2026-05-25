import type { Route } from 'next';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { formatNumber } from '@/lib/format';

/**
 * Dashboard summary tile. Shows a REAL count when available; when the count
 * couldn't be loaded (`value === null`) it degrades to a neutral "عرض القسم"
 * CTA instead of a fabricated number.
 */
export function SummaryTile({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: number | null;
  href: string;
}) {
  return (
    <Link
      href={href as Route}
      className="group flex items-center gap-4 rounded-2xl border border-hairline bg-surface p-5 shadow-soft transition-all duration-300 ease-smooth hover:-translate-y-1 hover:border-gold-300 hover:shadow-lift"
    >
      <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold-100 to-gold-200 text-gold-600 ring-1 ring-gold-200/70 transition-all duration-300 group-hover:from-gold-300 group-hover:to-gold-500 group-hover:text-navy group-hover:ring-gold-400">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        {value !== null ? (
          <div className="font-display text-2xl font-bold leading-none text-ink-strong">{formatNumber(value)}</div>
        ) : (
          <div className="text-sm font-medium text-gold-600">عرض القسم</div>
        )}
        <div className="mt-1 text-sm text-ink-muted">{label}</div>
      </div>
    </Link>
  );
}
