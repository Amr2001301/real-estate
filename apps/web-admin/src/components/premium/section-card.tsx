import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'default' | 'danger' | 'warning';

// U5: the panel look — no tinted header band or coloured icon chip; a thin
// gold-ringed icon, a Naskh title, and the tone only on the title.
const ICON_TONE: Record<Tone, string> = {
  default: 'border-brand-400/50 text-brand-700',
  danger:  'border-danger-600/40 text-danger-700',
  warning: 'border-warning-600/40 text-warning-700',
};

const TITLE_TONE: Record<Tone, string> = {
  default: 'text-slate-900',
  danger:  'text-danger-700',
  warning: 'text-warning-700',
};

export interface PremiumSectionCardProps {
  title: string;
  description?: string;
  /** Icon rendered in a small rounded badge in the header */
  icon?: ReactNode;
  /** Trailing slot in the header (e.g. an action button or badge) */
  trailing?: ReactNode;
  tone?: Tone;
  /** Whether to apply default padding to the content area. Default: true */
  padded?: boolean;
  /**
   * A navy title band — the header row of a list that is made of rows rather than a table, so it reads
   * like the navy header row every table has.
   */
  band?: boolean;
  children: ReactNode;
  className?: string;
}

export function PremiumSectionCard({
  title,
  description,
  icon,
  trailing,
  tone = 'default',
  padded = true,
  band = false,
  children,
  className,
}: PremiumSectionCardProps) {
  return (
    <section
      className={cn(
        'bg-surface border border-hairline rounded-[22px] overflow-hidden',
        className,
      )}
    >
      <header
        className={cn(
          'flex items-start justify-between gap-3 px-5 sm:px-6',
          band ? 'items-center bg-navy-band py-4 text-[#F4ECD8]' : cn('pt-5', padded ? 'pb-1' : 'pb-4 border-b border-hairline'),
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <span
              className={cn(
                'inline-flex h-10 w-10 items-center justify-center rounded-full border shrink-0 [&_svg]:h-4 [&_svg]:w-4',
                band ? 'border-[#D8B66A]/45 text-[#D8B66A]' : ICON_TONE[tone],
              )}
            >
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h3 className={cn('font-heading text-[18px] font-bold leading-snug', band ? 'text-[#F4ECD8]' : TITLE_TONE[tone])}>{title}</h3>
            {description && <p className={cn('text-[13px] mt-0.5 leading-snug', band ? 'text-[#A9B0BD]' : 'text-slate-500')}>{description}</p>}
          </div>
        </div>
        {trailing && <div className="shrink-0">{trailing}</div>}
      </header>

      <div className={cn(padded && 'p-5 sm:p-6')}>{children}</div>
    </section>
  );
}
