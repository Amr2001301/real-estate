import type { ReactNode } from 'react';
import Link from 'next/link';
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
  href?: string;
}

interface Props {
  items: AlertItem[];
  className?: string;
}

const BASE_ROW =
  'relative flex items-start gap-3 rounded-xl bg-surface border border-hairline px-4 py-3 ' +
  'before:absolute before:start-0 before:top-2.5 before:bottom-2.5 before:w-[2px] before:rounded-s-full';

export function AlertList({ items, className }: Props) {
  return (
    <ul className={cn('flex flex-col gap-2.5', className)}>
      {items.map((it) => {
        const inner = (
          <>
            {it.icon && (
              <span
                className={cn(
                  'inline-flex h-9 w-9 items-center justify-center rounded-lg shrink-0',
                  '[&_svg]:h-[18px] [&_svg]:w-[18px]',
                  ICON_BG[it.tone],
                )}
              >
                {it.icon}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900 leading-tight">{it.title}</p>
              {it.description && (
                <p className="mt-0.5 text-xs text-slate-500">{it.description}</p>
              )}
            </div>
          </>
        );

        const rowClass = cn(BASE_ROW, STRIPE[it.tone], it.href && 'hover:bg-brand-50/40 hover:border-brand-200 transition-colors duration-150');

        return it.href ? (
          <li key={it.id}>
            <Link href={it.href as never} className={rowClass}>
              {inner}
            </Link>
          </li>
        ) : (
          <li key={it.id} className={rowClass}>
            {inner}
          </li>
        );
      })}
    </ul>
  );
}
