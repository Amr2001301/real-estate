import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface PremiumCommandPanelProps {
  /** Optional title rendered above the content in small caps */
  title?: string;
  children: ReactNode;
  className?: string;
}

export function PremiumCommandPanel({
  title,
  children,
  className,
}: PremiumCommandPanelProps) {
  return (
    <div
      className={cn(
        'rounded-[20px] bg-sidebar-bg shadow-md overflow-hidden border border-white/[0.06]',
        className,
      )}
    >
      {/* Gold accent stripe */}
      <div className="h-[3px] bg-gradient-to-r from-brand-700/60 via-brand-400/80 to-brand-700/60" />

      <div className="p-4 sm:p-5">
        {title && (
          <h3 className="text-[12px] font-bold text-white/55 uppercase tracking-[0.12em] px-1 mb-3.5">
            {title}
          </h3>
        )}
        {children}
      </div>
    </div>
  );
}

/** Action row for use inside PremiumCommandPanel — link variant */
export interface CommandAction {
  key: string;
  label: string;
  icon: ReactNode;
  href?: string;
  external?: boolean;
  tone?: 'default' | 'danger';
}
