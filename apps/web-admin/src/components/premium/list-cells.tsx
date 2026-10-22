import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { EntityLink, type EntityKind } from '@/components/entity-link';

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
export function CodeCell({
  href,
  code,
  muted,
  title,
  kind,
}: {
  href: string;
  code: string;
  muted?: boolean;
  title?: string;
  /** Arabic word shown before the code (عقد / حجز) when the column mixes kinds. */
  kind?: string;
}) {
  return (
    <Link
      href={href as never}
      title={title}
      data-testid="list-code"
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1 text-[12px] font-bold transition-colors',
        muted
          ? 'bg-surface-muted text-slate-500 hover:text-brand-700'
          : 'bg-brand-500/[0.08] text-brand-700 hover:bg-brand-500/15',
      )}
    >
      {kind && <span className="font-sans text-[11px] font-semibold opacity-75">{kind}</span>}
      <span dir="ltr" className="font-mono">{code}</span>
    </Link>
  );
}

export function PersonCell({
  name,
  sub,
  subLabel,
  muted,
  nameLink,
  subLink,
}: {
  name: string;
  sub?: string | null;
  /** Arabic word before the sub line (e.g. وحدة before a unit code). */
  subLabel?: string;
  muted?: boolean;
  /** The name opens its page (customer, client…). Leave unset inside a row link. */
  nameLink?: { kind: EntityKind; id: string | null | undefined };
  /** The sub line (e.g. a unit code) opens its page. */
  subLink?: { kind: EntityKind; id: string | null | undefined };
}) {
  return (
    <div className="flex min-w-[160px] max-w-[210px] items-center gap-3" title={name}>
      <span
        aria-hidden
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400/30 to-brand-700/15 text-[12px] font-bold text-brand-700 ring-1 ring-brand-500/30"
      >
        {muted ? '؟' : initials(name)}
      </span>
      <div className="min-w-0">
        <p dir="auto" className={cn('truncate font-semibold', muted ? 'text-[12px] italic text-slate-400' : 'text-slate-900')}>
          {nameLink ? <EntityLink kind={nameLink.kind} id={nameLink.id} mono={false}>{name}</EntityLink> : name}
        </p>
        {sub && (
          <p className="whitespace-nowrap text-[11.5px] tabular-nums text-slate-500">
            {subLabel && <span className="me-1 text-slate-400">{subLabel}</span>}
            {subLink ? <EntityLink kind={subLink.kind} id={subLink.id} mono={false}><span dir="ltr">{sub}</span></EntityLink> : <span dir="ltr">{sub}</span>}
          </p>
        )}
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
