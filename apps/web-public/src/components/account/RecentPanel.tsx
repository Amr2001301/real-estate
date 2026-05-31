import type { Route } from 'next';
import Link from 'next/link';
import { ArrowLeft, type LucideIcon } from 'lucide-react';
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
    <PremiumCard className={cn('flex flex-col p-2.5 sm:p-3', className)}>
      <div className="flex items-center justify-between gap-3 px-2.5 pb-1 pt-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-gold-100 to-gold-200 text-gold-600 ring-1 ring-gold-200/70">
            <Icon className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <h2 className="truncate text-base font-bold text-ink-strong">{title}</h2>
        </div>
        {href && (
          <Link
            href={href as Route}
            className="group inline-flex shrink-0 items-center gap-1 text-sm font-medium text-gold-600 transition-colors hover:text-gold-500"
          >
            {linkLabel}
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" aria-hidden />
          </Link>
        )}
      </div>
      <div className="mt-1 space-y-0.5">{children}</div>
    </PremiumCard>
  );
}
