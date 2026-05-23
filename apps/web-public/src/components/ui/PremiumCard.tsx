import { cn } from '@/lib/cn';

interface PremiumCardProps {
  className?: string;
  /** Adds a subtle hover lift — use for interactive/clickable cards. */
  interactive?: boolean;
  children: React.ReactNode;
}

/** Rounded, softly-shadowed white card — the premium content surface. */
export function PremiumCard({ className, interactive = false, children }: PremiumCardProps) {
  return (
    <div
      className={cn(
        'rounded-3xl border border-hairline bg-surface shadow-card',
        interactive &&
          'transition-all duration-300 ease-smooth hover:-translate-y-1 hover:shadow-lift',
        className,
      )}
    >
      {children}
    </div>
  );
}
