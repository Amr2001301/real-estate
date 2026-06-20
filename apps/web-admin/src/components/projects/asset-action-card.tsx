import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
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
  className?: string;
}

export function AssetActionCard({ title, actions, className }: Props) {
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
        <h3 className="text-[12px] font-bold text-white/55 uppercase tracking-[0.12em] px-1 mb-3.5">
          {title}
        </h3>
        <div className="flex flex-col gap-1.5">
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
                  'group flex items-center gap-3 rounded-xl bg-sidebar-bg-elev/60 hover:bg-sidebar-bg-elev px-3 py-2.5 text-sm transition-colors duration-150',
                  a.tone === 'danger'
                    ? 'text-danger-300 hover:text-danger-200'
                    : 'text-white/85 hover:text-white',
                )}
              >
                <span
                  className={cn(
                    'inline-flex h-9 w-9 items-center justify-center rounded-xl shrink-0 [&_svg]:h-4 [&_svg]:w-4',
                    a.tone === 'danger'
                      ? 'bg-danger-500/15 text-danger-300'
                      : 'bg-brand-400/20 text-brand-300',
                  )}
                >
                  {a.icon}
                </span>
                <span className="flex-1 font-medium text-[13px]">{a.label}</span>
                <ChevronLeft className="h-3.5 w-3.5 text-sidebar-text-muted/50 group-hover:text-white/70 transition-colors" />
              </Link>
            ),
          )}
        </div>
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
          'group w-full flex items-center gap-3 rounded-xl bg-sidebar-bg-elev/60 hover:bg-sidebar-bg-elev px-3 py-2.5 text-sm transition-colors duration-150',
          tone === 'danger'
            ? 'text-danger-300 hover:text-danger-200'
            : 'text-white/85 hover:text-white',
        )}
      >
        <span
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-xl shrink-0 [&_svg]:h-4 [&_svg]:w-4',
            tone === 'danger'
              ? 'bg-danger-500/15 text-danger-300'
              : 'bg-brand-400/20 text-brand-300',
          )}
        >
          {icon}
        </span>
        <span className="flex-1 font-medium text-[13px] text-start">{label}</span>
        <ChevronLeft className="h-3.5 w-3.5 text-sidebar-text-muted/50 group-hover:text-white/70 transition-colors" />
      </button>
    </form>
  );
}
