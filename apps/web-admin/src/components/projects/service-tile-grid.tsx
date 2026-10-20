import { Building2 } from 'lucide-react';
import type { Translatable } from '@/lib/types';
import { cn } from '@/lib/cn';
import { findPreset } from './services-preset';

interface Props {
  services: Translatable[];
  className?: string;
}

export function ServiceTileGrid({ services, className }: Props) {
  if (!services || services.length === 0) return null;
  return (
    <div
      className={cn(
        'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3',
        className,
      )}
    >
      {services.map((s, i) => {
        const preset = findPreset(s.ar);
        const Icon = preset?.icon ?? Building2;
        return (
          <div
            key={`${s.ar}-${i}`}
            className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-hairline bg-surface-muted/40 px-3 py-5 text-center transition-colors hover:border-brand-500/40"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-500/12 text-brand-700">
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </span>
            <span className="text-[13px] font-semibold leading-snug text-slate-800">
              {s.ar}
            </span>
          </div>
        );
      })}
    </div>
  );
}
