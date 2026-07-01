import type { ReactNode } from 'react';
import { LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface PremiumCommandPanelProps {
  title?: string;
  /** Optional icon shown in the header badge. Defaults to LayoutGrid. */
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function PremiumCommandPanel({
  title,
  icon,
  children,
  className,
}: PremiumCommandPanelProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[20px] border border-hairline bg-surface shadow-soft',
        className,
      )}
    >
      {title && (
        <div className="flex items-center gap-3 border-b border-hairline bg-canvas/30 px-5 py-4">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 ring-1 ring-brand-100 [&_svg]:h-[15px] [&_svg]:w-[15px] [&_svg]:text-brand-600">
            {icon ?? <LayoutGrid />}
          </span>
          <h3 className="text-[13.5px] font-bold text-navy">{title}</h3>
        </div>
      )}
      <div className="divide-y divide-hairline">{children}</div>
    </div>
  );
}

export interface CommandAction {
  key: string;
  label: string;
  icon: ReactNode;
  href?: string;
  external?: boolean;
  tone?: 'default' | 'danger';
}
