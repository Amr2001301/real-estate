import { cn } from '@/lib/cn';

interface StatCardProps {
  value: string;
  label: string;
  invert?: boolean;
  className?: string;
}

export function StatCard({ value, label, invert = false, className }: StatCardProps) {
  return (
    <div className={cn('text-center', className)}>
      <div
        className={cn(
          'font-display text-display-2 leading-none',
          invert ? 'text-gold-200' : 'text-ink-strong',
        )}
      >
        {value}
      </div>
      <div className={cn('mt-2 text-sm', invert ? 'text-white/70' : 'text-ink-muted')}>{label}</div>
    </div>
  );
}
