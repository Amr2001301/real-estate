import type { Route } from 'next';
import Link from 'next/link';
import { type LucideIcon } from 'lucide-react';
import { formatNumber } from '@/lib/format';

/**
 * Account stat card — same gold-glow language as the marketing-site feature
 * cards, but a DENSE layout: the value leads (reading-start) with the icon chip
 * on the end, so a single digit never floats in empty space. Premium feel comes
 * from the warm corner glow + gold gradient chip + hover lift, never a dark fill.
 *
 * Shows a REAL value when available; degrades to a neutral "عرض القسم" CTA when
 * it couldn't be loaded. `valueText` (e.g. a currency total) wins over `value`.
 */

const GLOW = {
  background: 'radial-gradient(circle at 100% 0%, rgba(200,162,75,0.14), transparent 62%)',
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
      className="group relative flex h-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-hairline bg-surface px-5 py-7 text-center shadow-[0_8px_30px_rgb(15,30,51,0.05)] transition-all duration-300 ease-smooth hover:-translate-y-1.5 hover:border-gold-300 hover:shadow-[0_0_0_3px_rgba(200,162,75,0.16),0_24px_50px_-18px_rgba(15,30,51,0.28)]"
    >
      <span className="pointer-events-none absolute inset-0" style={GLOW} aria-hidden />

      {/* Gold icon chip — center-aligned at the top of the tile */}
      <span className="relative inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-100 to-gold-200 text-gold-600 ring-1 ring-gold-200/70 transition-all duration-300 group-hover:from-gold-300 group-hover:to-gold-500 group-hover:text-navy group-hover:ring-gold-400">
        <Icon className="h-6 w-6" aria-hidden />
      </span>

      <div className="relative min-w-0">
        {display != null ? (
          <div className="break-words font-display text-3xl font-extrabold leading-none tracking-tight text-ink-strong sm:text-4xl">
            {display}
          </div>
        ) : (
          <div className="text-base font-semibold text-gold-600">عرض القسم</div>
        )}
        <div className="mt-2.5 text-sm font-medium text-ink-muted">{label}</div>
      </div>
    </Link>
  );
}
