import { cn } from '@/lib/cn';

interface DividerProps {
  /** Renders a short centered gold accent line instead of a full hairline. */
  accent?: boolean;
  className?: string;
}

export function Divider({ accent = false, className }: DividerProps) {
  if (accent) {
    return <span className={cn('block h-px w-16 bg-gold-400', className)} aria-hidden />;
  }
  return <hr className={cn('border-0 border-t border-hairline', className)} />;
}
