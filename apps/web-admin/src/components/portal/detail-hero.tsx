import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/card';

/* ──────────────────────────────────────────────────────────────────────────────
 * Status → a 4px inline-start border (right edge in RTL) applied via
 * inline style so it bypasses Tailwind-merge and always wins the cascade.
 * ──────────────────────────────────────────────────────────────────────────── */
export type DetailHeroStatus = 'success' | 'warning' | 'danger' | 'neutral';

const ACCENT_STYLE: Record<DetailHeroStatus, CSSProperties> = {
  success: { borderInlineStartWidth: 4, borderInlineStartColor: '#10b981' }, // emerald-500
  warning: { borderInlineStartWidth: 4, borderInlineStartColor: '#f59e0b' }, // amber-500
  danger:  { borderInlineStartWidth: 4, borderInlineStartColor: '#f87171' }, // red-400
  neutral: { borderInlineStartWidth: 4, borderInlineStartColor: '#cbd5e1' }, // slate-300
};

/* ──────────────────────────────────────────────────────────────────────────────
 * DetailHero
 * Top summary card on every portal detail page.
 * status: controls the 4px start-edge accent (right in RTL).
 * No decorative strip — status is communicated via badge (PageHeader) +
 * this subtle accent + tinted column background.
 * ──────────────────────────────────────────────────────────────────────────── */
export function DetailHero({
  status = 'neutral',
  children,
}: {
  status?: DetailHeroStatus;
  children: ReactNode;
}) {
  return (
    <Card
      className="overflow-hidden"
      style={ACCENT_STYLE[status]}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3">{children}</div>
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
 * DetailHeroCol
 * One column inside DetailHero.  Each column owns its own p-6 padding.
 * position="middle" adds separator borders (horizontal on mobile, vertical lg).
 * ──────────────────────────────────────────────────────────────────────────── */
export function DetailHeroCol({
  position = 'first',
  highlight,
  className,
  children,
}: {
  position?: 'first' | 'middle' | 'last';
  highlight?: DetailHeroStatus;   // tints the column background
  className?: string;
  children: ReactNode;
}) {
  const tint =
    highlight === 'success' ? 'bg-emerald-50/40' :
    highlight === 'warning' ? 'bg-amber-50/30'   :
    highlight === 'danger'  ? 'bg-red-50/20'     : '';

  return (
    <div
      className={cn(
        'p-5',
        position === 'middle' && 'border-y lg:border-y-0 lg:border-x border-hairline',
        tint,
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
 * HeroColLabel  — tiny all-caps section label above column content
 * ──────────────────────────────────────────────────────────────────────────── */
export function HeroColLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-2xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
      {children}
    </p>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
 * HeroDateRow  — label / value pair for the meta column
 * tone="success" → emerald  |  "warning" → amber  |  default → slate
 * ──────────────────────────────────────────────────────────────────────────── */
export function HeroDateRow({
  label,
  value,
  tone,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: 'success' | 'warning';
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span
        className={cn(
          'text-xs shrink-0',
          tone === 'success' ? 'text-emerald-700' :
          tone === 'warning' ? 'text-amber-700'   : 'text-slate-500',
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          'text-xs text-end',
          tone === 'success' ? 'text-emerald-700 font-semibold' :
          tone === 'warning' ? 'text-amber-700 font-semibold'   :
          'text-slate-800 font-medium',
        )}
      >
        {value}
      </span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
 * StatusDot  — small colored dot used as an inline status marker
 * ──────────────────────────────────────────────────────────────────────────── */
export function StatusDot({ status }: { status: DetailHeroStatus }) {
  const color = {
    success: 'bg-emerald-500',
    warning: 'bg-amber-400',
    danger:  'bg-red-400',
    neutral: 'bg-slate-300',
  }[status];

  return <span className={cn('inline-block h-2 w-2 rounded-full shrink-0', color)} />;
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Avatar helpers — shared across pages that show a client/entity avatar
 * ──────────────────────────────────────────────────────────────────────────── */
const AVATAR_PALETTE = [
  'bg-slate-100 text-slate-700',
  'bg-emerald-100 text-emerald-700',
  'bg-violet-100 text-violet-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
];

export function avatarColor(name: string): string {
  if (!name) return AVATAR_PALETTE[0]!;
  const code = name.charCodeAt(0) + (name.charCodeAt(1) || 0);
  return AVATAR_PALETTE[code % AVATAR_PALETTE.length]!;
}

export function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}
