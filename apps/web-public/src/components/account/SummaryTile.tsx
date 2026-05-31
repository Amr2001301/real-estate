import type { Route } from 'next';
import Link from 'next/link';
import { ArrowLeft, type LucideIcon } from 'lucide-react';
import { formatNumber } from '@/lib/format';

/**
 * Account stat card. Visually identical to the marketing-site feature cards
 * (WhyChooseUs / InvestmentCategories): a light surface with a warm gold corner
 * glow, a gold gradient icon chip, and a hover lift + gold ring — so the
 * customer area reads as part of the same premium site, not an admin dashboard.
 *
 * Shows a REAL value when available; when it couldn't be loaded it degrades to
 * a neutral "عرض القسم" CTA instead of a fabricated number. `valueText` (e.g. a
 * formatted currency total) takes precedence over the numeric `value`.
 */

// Warm gold corner glow — shared with the homepage feature surfaces.
const GLOW = {
  background: 'radial-gradient(circle at 100% 0%, rgba(200,162,75,0.14), transparent 60%)',
} as const;

export function SummaryTile({
  icon: Icon,
  label,
  value,
  valueText,
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: number | null;
  valueText?: string | null;
  href: string;
}) {
  const display = valueText != null ? valueText : value !== null ? formatNumber(value) : null;

  return (
    <Link
      href={href as Route}
      className="group relative flex h-full flex-col justify-between gap-6 overflow-hidden rounded-2xl border border-hairline bg-surface p-5 shadow-soft transition-all duration-300 ease-smooth hover:-translate-y-1 hover:border-gold-300 hover:shadow-[0_0_0_3px_rgba(200,162,75,0.16),0_18px_44px_-16px_rgba(15,30,51,0.20)]"
    >
      <span className="pointer-events-none absolute inset-0" style={GLOW} aria-hidden />

      <div className="relative flex items-start justify-between">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold-100 to-gold-200 text-gold-600 ring-1 ring-gold-200/70 transition-all duration-300 group-hover:from-gold-300 group-hover:to-gold-500 group-hover:text-navy group-hover:ring-gold-400">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <ArrowLeft
          className="h-4 w-4 -translate-x-1 text-gold-500 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
          aria-hidden
        />
      </div>

      <div className="relative min-w-0">
        {display != null ? (
          <div className="font-display text-[1.65rem] font-bold leading-none text-ink-strong">{display}</div>
        ) : (
          <div className="text-sm font-medium text-gold-600">عرض القسم</div>
        )}
        <div className="mt-2 text-sm text-ink-muted">{label}</div>
      </div>
    </Link>
  );
}
