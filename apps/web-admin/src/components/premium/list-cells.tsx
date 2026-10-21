import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Shared table cells for the premium list pages (visits, reservations, contracts).
 * Codes, amounts and dates never wrap; names sit beside an initials avatar.
 */

function initials(name: string): string {
  // Words that start with a letter only: "E2E Visitor 1792…" reads EV, not E1.
  const parts = name.trim().split(/\s+/).filter((w) => /^\p{L}/u.test(w));
  if (!parts.length || name === '—') return '؟';
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  // Skip the Arabic article: "رامي الشريف" reads رش, not را.
  const lead = (w: string) => (w.length > 3 && w.startsWith('ال') ? w.charAt(2) : w.charAt(0));
  return (lead(parts[0]!) + lead(parts[parts.length - 1]!)).toUpperCase();
}

/** Record number link; `muted` marks a short id shown when the record has no number. */
export function CodeCell({ href, code, muted, title }: { href: string; code: string; muted?: boolean; title?: string }) {
  return (
    <Link
      href={href as never}
      title={title}
      dir="ltr"
      data-testid="list-code"
      className={cn(
        'inline-flex whitespace-nowrap rounded-lg px-2 py-1 font-mono text-[12px] font-bold transition-colors',
        muted
          ? 'bg-surface-muted text-slate-500 hover:text-brand-700'
          : 'bg-brand-500/[0.08] text-brand-700 hover:bg-brand-500/15',
      )}
    >
      {code}
    </Link>
  );
}

export function PersonCell({ name, sub, muted }: { name: string; sub?: string | null; muted?: boolean }) {
  return (
    <div className="flex min-w-[160px] max-w-[210px] items-center gap-3" title={name}>
      <span
        aria-hidden
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400/30 to-brand-700/15 text-[12px] font-bold text-brand-700 ring-1 ring-brand-500/30"
      >
        {muted ? '؟' : initials(name)}
      </span>
      <div className="min-w-0">
        <p dir="auto" className={cn('truncate font-semibold', muted ? 'text-[12px] italic text-slate-400' : 'text-slate-900')}>{name}</p>
        {sub && <p className="whitespace-nowrap text-[11.5px] tabular-nums text-slate-500" dir="ltr">{sub}</p>}
      </div>
    </div>
  );
}

/** Main line + secondary line, both kept on one line each. */
export function StackCell({ main, sub, className }: { main: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="max-w-[220px] truncate whitespace-nowrap font-medium text-slate-800">{main}</p>
      {sub && <p className="max-w-[220px] truncate whitespace-nowrap text-[11.5px] text-slate-500">{sub}</p>}
    </div>
  );
}
