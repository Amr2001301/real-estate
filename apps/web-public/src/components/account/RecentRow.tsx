import type { LucideIcon } from 'lucide-react';

/**
 * Compact activity row for the dashboard's "recent" lists. Display-only (the
 * full sections carry the detail links) so it stays tight.
 */
export function RecentRow({
  icon: Icon,
  title,
  subtitle,
  trailing,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-hairline bg-surface px-4 py-3">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold-100 text-gold-600">
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-medium text-ink-strong">{title}</p>
        {subtitle && <p className="line-clamp-1 text-xs text-ink-muted">{subtitle}</p>}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  );
}
