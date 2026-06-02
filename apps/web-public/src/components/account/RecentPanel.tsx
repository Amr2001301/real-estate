import type { Route } from 'next';
import Link from 'next/link';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { PremiumCard } from '@/components/ui/PremiumCard';

interface RecentPanelProps {
  icon: LucideIcon;
  title: string;
  /** Optional "view all" link in the panel header. */
  href?: string;
  linkLabel?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Editorial panel that groups a section's recent rows into one calm surface —
 * header (gold icon chip + title + "عرض الكل") over a tight list of borderless
 * `RecentRow`s. Replaces the previous "wall of individually-bordered cards" so
 * the dashboard reads as a few composed modules instead of box soup.
 */
export function RecentPanel({ icon: Icon, title, href, linkLabel = 'عرض الكل', className, children }: RecentPanelProps) {
  return (
    <PremiumCard className={cn('flex flex-col p-5', className)}>
      <div className="mb-4 flex h-8 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-gold-100 to-gold-200 text-gold-600 ring-1 ring-gold-200/70">
            <Icon className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <h2 className="truncate text-base font-bold text-ink-strong">{title}</h2>
        </div>
        {href && (
          <Link
            href={href as Route}
            className="inline-flex shrink-0 items-center rounded-lg border border-hairline/70 bg-surface-soft px-3 py-1 text-[10px] font-extrabold text-ink-strong shadow-sm transition-all duration-200 hover:bg-hairline/40"
          >
            {linkLabel}
          </Link>
        )}
      </div>
      <div className="divide-y divide-hairline/60">{children}</div>
    </PremiumCard>
  );
}
