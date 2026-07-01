import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface AssetAction {
  key: string;
  label: string;
  icon: ReactNode;
  href?: string;
  /** External URL — renders in a new tab. */
  external?: boolean;
  /** Inline form (server action). When provided, renders a submit button. */
  form?: ReactNode;
  tone?: 'default' | 'danger';
}

interface Props {
  title: string;
  actions: AssetAction[];
  /** Optional icon shown in the card header. Defaults to LayoutGrid. */
  icon?: ReactNode;
  className?: string;
}

const ROW_CLS =
  'group flex items-center gap-3 px-5 py-3.5 transition-colors duration-150';

export function AssetActionCard({ title, actions, icon, className }: Props) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[20px] border border-hairline bg-surface shadow-soft',
        className,
      )}
    >
      {/* Header band — same as Description / Phases / Map cards on the page */}
      <div className="flex items-center gap-3 border-b border-hairline bg-canvas/30 px-5 py-4">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 ring-1 ring-brand-100 [&_svg]:h-[15px] [&_svg]:w-[15px] [&_svg]:text-brand-600">
          {icon ?? <LayoutGrid />}
        </span>
        <h3 className="text-[13.5px] font-bold text-navy">{title}</h3>
      </div>

      {/* Action rows — divided list */}
      <div className="divide-y divide-hairline">
        {actions.map((a) =>
          a.form ? (
            <div key={a.key}>{a.form}</div>
          ) : (
            <Link
              key={a.key}
              href={(a.href ?? '#') as never}
              target={a.external ? '_blank' : undefined}
              rel={a.external ? 'noopener noreferrer' : undefined}
              className={cn(
                ROW_CLS,
                a.tone === 'danger'
                  ? 'hover:bg-danger-50/40'
                  : 'hover:bg-canvas/40',
              )}
            >
              <span
                className={cn(
                  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl [&_svg]:h-[15px] [&_svg]:w-[15px]',
                  a.tone === 'danger'
                    ? 'bg-danger-50 text-danger-500'
                    : 'bg-slate-100 text-slate-500',
                )}
              >
                {a.icon}
              </span>
              <span
                className={cn(
                  'flex-1 text-[13px] font-medium',
                  a.tone === 'danger' ? 'text-danger-600' : 'text-slate-700',
                )}
              >
                {a.label}
              </span>
              <ChevronLeft className="h-3.5 w-3.5 text-slate-300 transition-colors group-hover:text-slate-400" />
            </Link>
          ),
        )}
      </div>
    </div>
  );
}

/** Helper for action items that submit a server action. */
export function AssetActionForm({
  action,
  label,
  icon,
  tone = 'default',
}: {
  action: () => Promise<void> | Promise<unknown>;
  label: string;
  icon: ReactNode;
  tone?: 'default' | 'danger';
}) {
  return (
    <form action={action as never}>
      <button
        type="submit"
        className={cn(
          ROW_CLS,
          'w-full',
          tone === 'danger' ? 'hover:bg-danger-50/40' : 'hover:bg-canvas/40',
        )}
      >
        <span
          className={cn(
            'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl [&_svg]:h-[15px] [&_svg]:w-[15px]',
            tone === 'danger'
              ? 'bg-danger-50 text-danger-500'
              : 'bg-slate-100 text-slate-500',
          )}
        >
          {icon}
        </span>
        <span
          className={cn(
            'flex-1 text-start text-[13px] font-medium',
            tone === 'danger' ? 'text-danger-600' : 'text-slate-700',
          )}
        >
          {label}
        </span>
        <ChevronLeft className="h-3.5 w-3.5 text-slate-300 transition-colors group-hover:text-slate-400" />
      </button>
    </form>
  );
}
