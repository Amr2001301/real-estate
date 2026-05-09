import { Building2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface HeroStat {
  label: string;
  value: ReactNode;
  sub?: string;
}

interface Props {
  src?: string | null;
  alt?: string;
  stats?: HeroStat[];
  rightLabel?: string;
  rightValue?: ReactNode;
  rightSub?: string;
  className?: string;
}

export function ProjectHero({
  src,
  alt = '',
  stats,
  rightLabel,
  rightValue,
  rightSub,
  className,
}: Props) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl shadow-md ring-1 ring-inset ring-hairline',
        'bg-sidebar-bg',
        className,
      )}
    >
      <div className="relative aspect-[16/7] min-h-[220px] sm:min-h-[280px] w-full">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-sidebar-bg-elev to-sidebar-bg">
            <Building2 className="h-20 w-20 text-brand-300/40" strokeWidth={1.5} />
          </div>
        )}

        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-sidebar-bg via-sidebar-bg/40 to-transparent"
        />

        {(rightLabel || rightValue) && (
          <div className="absolute top-5 start-5 sm:top-6 sm:start-6 text-white">
            {rightLabel && (
              <p className="text-xs font-medium text-white/70 mb-1">{rightLabel}</p>
            )}
            {rightValue && (
              <p className="text-3xl sm:text-4xl font-bold tracking-tight tabular-nums">
                {rightValue}
              </p>
            )}
            {rightSub && (
              <p className="text-xs text-white/60 mt-1">{rightSub}</p>
            )}
          </div>
        )}

        {stats && stats.length > 0 && (
          <div className="absolute bottom-5 end-5 sm:bottom-6 sm:end-6 flex flex-wrap items-end gap-2.5">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl bg-white/10 backdrop-blur-md ring-1 ring-inset ring-white/15 text-white px-4 py-3 min-w-[110px]"
              >
                <p className="text-2xs font-medium uppercase tracking-wider text-white/60">
                  {s.label}
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums">{s.value}</p>
                {s.sub && <p className="text-2xs text-white/55 mt-0.5">{s.sub}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
