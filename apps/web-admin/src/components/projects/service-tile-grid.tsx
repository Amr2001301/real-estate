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
            className="flex flex-col items-center justify-center text-center gap-2 rounded-2xl border border-hairline bg-info-50/50 px-3 py-4"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </span>
            <span className="text-xs font-medium text-slate-700 leading-snug">
              {s.ar}
            </span>
          </div>
        );
      })}
    </div>
  );
}
