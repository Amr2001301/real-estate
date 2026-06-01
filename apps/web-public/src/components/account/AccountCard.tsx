import { cn } from '@/lib/cn';

/**
 * The shared surface for every account card. Gives the whole portal one
 * premium, cohesive language: a warm gold corner glow, a status-aware accent
 * rail on the start (reading) edge — like a filed, indexed document — and an
 * optional hover lift + gold ring for linked cards. Stays in the Warm-Luxe
 * light palette; the rail is the only colour that reacts to state.
 */

export type AccountCardAccent = 'gold' | 'success' | 'error' | 'navy' | 'muted';

const RAIL: Record<AccountCardAccent, string> = {
  gold: 'from-gold-300 to-gold-500',
  success: 'from-success/55 to-success',
  error: 'from-error/55 to-error',
  navy: 'from-navy-600 to-navy',
  muted: 'from-hairline to-ink-muted/40',
};

const GLOW = {
  background: 'radial-gradient(circle at 100% 0%, rgba(200,162,75,0.12), transparent 58%)',
} as const;

interface AccountCardProps {
  accent?: AccountCardAccent;
  /** Adds a hover lift + gold ring — use when the whole card is a link. */
  interactive?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function AccountCard({ accent = 'gold', interactive = false, className, children }: AccountCardProps) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-3xl border border-hairline bg-surface shadow-card',
        interactive &&
          'transition-all duration-300 ease-smooth hover:-translate-y-1 hover:border-gold-300 hover:shadow-[0_0_0_3px_rgba(200,162,75,0.16),0_18px_44px_-16px_rgba(15,30,51,0.20)]',
        className,
      )}
    >
      <span
        className={cn('pointer-events-none absolute inset-y-0 start-0 w-1 bg-gradient-to-b', RAIL[accent])}
        aria-hidden
      />
      <span className="pointer-events-none absolute inset-0" style={GLOW} aria-hidden />
      <div className="relative">{children}</div>
    </div>
  );
}

/** Premium gold gradient icon chip — the shared account-card chip. */
export function AccountCardIcon({
  children,
  size = 'md',
  className,
}: {
  children: React.ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold-100 to-gold-200 text-gold-600 ring-1 ring-gold-200/70',
        size === 'md' ? 'h-11 w-11' : 'h-9 w-9',
        className,
      )}
    >
      {children}
    </span>
  );
}
