import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'danger' | 'warning' | 'info' | 'neutral';

const STRIPE: Record<Tone, string> = {
  danger: 'before:bg-danger-500',
  warning: 'before:bg-warning-500',
  info: 'before:bg-info-500',
  neutral: 'before:bg-slate-300',
};

const ICON_BG: Record<Tone, string> = {
  danger: 'bg-danger-50 text-danger-600',
  warning: 'bg-warning-50 text-warning-600',
  info: 'bg-info-50 text-info-600',
  neutral: 'bg-slate-100 text-slate-600',
};

export interface AlertItem {
  id: string;
  tone: Tone;
  title: string;
  description?: string;
  icon?: ReactNode;
}

interface Props {
  items: AlertItem[];
  className?: string;
}

export function AlertList({ items, className }: Props) {
  return (
    <ul className={cn('flex flex-col gap-3', className)}>
      {items.map((it) => (
        <li
          key={it.id}
          className={cn(
            'relative flex items-start gap-3 rounded-2xl bg-surface-muted/60 px-4 py-3.5',
            'before:absolute before:start-0 before:top-3 before:bottom-3 before:w-[3px] before:rounded-s-full',
            STRIPE[it.tone],
          )}
        >
          {it.icon && (
            <span
              className={cn(
                'inline-flex h-9 w-9 items-center justify-center rounded-xl shrink-0',
                '[&_svg]:h-4 [&_svg]:w-4',
                ICON_BG[it.tone],
              )}
            >
              {it.icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 leading-tight">
              {it.title}
            </p>
            {it.description && (
              <p className="mt-1 text-xs text-slate-500">{it.description}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
