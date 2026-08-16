import { Inbox } from 'lucide-react';
import { cn } from '@/lib/cn';
import { IconCircle } from '@/components/ui/IconCircle';

interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

/** Warm, inviting empty state — not a cold grey blank. */
export function EmptyState({
  title = 'Nothing here yet',
  message = 'Check back soon.',
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-3xl border border-dashed border-hairline bg-surface-soft/60 px-8 py-16 text-center',
        className,
      )}
    >
      <IconCircle tone="gold" className="mb-5 h-14 w-14">
        {icon ?? <Inbox className="h-6 w-6" aria-hidden />}
      </IconCircle>
      <h3 className="text-xl text-ink-strong">{title}</h3>
      <p className="mt-2 max-w-sm text-ink-muted">{message}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
