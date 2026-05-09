import Link from 'next/link';
import { cn } from '@/lib/cn';

export interface TabItem {
  label: string;
  href: string;
  count?: number;
}

export interface TabsProps {
  items: TabItem[];
  /** Currently-active href (compared with startsWith). Server-friendly. */
  activeHref?: string;
  className?: string;
}

export function Tabs({ items, activeHref, className }: TabsProps) {
  return (
    <div
      className={cn(
        'border-b border-hairline mb-6 overflow-x-auto scrollbar-thin',
        className,
      )}
      role="tablist"
    >
      <div className="flex items-stretch gap-1 min-w-max">
        {items.map((item) => {
          const active = activeHref === item.href;
          return (
            <Link
              key={item.href}
              href={item.href as never}
              role="tab"
              aria-selected={active}
              className={cn(
                'relative inline-flex items-center gap-2 px-3.5 h-10 -mb-px text-sm font-medium transition-colors',
                'border-b-2',
                active
                  ? 'text-brand-700 border-brand-600'
                  : 'text-slate-500 border-transparent hover:text-slate-900 hover:border-slate-200',
              )}
            >
              {item.label}
              {typeof item.count === 'number' && (
                <span
                  className={cn(
                    'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-2xs font-semibold',
                    active ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-600',
                  )}
                >
                  {item.count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
