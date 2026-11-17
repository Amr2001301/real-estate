import Link from 'next/link';
import type { ReactNode } from 'react';
import { Building2, Phone } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/cockpit/cockpit';

/**
 * Building blocks of the redesigned list pages (reservations, contracts, visits —
 * regular and broker side): one card with a title and a count, a dense table
 * with a tinted header row, and rich cells (person, unit with photo, agent).
 */

export function ListTableCard({
  title,
  sub,
  trailing,
  children,
  testId,
}: {
  title: string;
  sub?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <section
      data-testid={testId}
      className="overflow-hidden rounded-[22px] border border-hairline bg-surface shadow-[0_1px_2px_rgb(11_18_32/0.04),0_10px_30px_-10px_rgb(11_18_32/0.08),0_30px_60px_-30px_rgb(11_18_32/0.12)] dark:shadow-none"
    >
      <header className="flex items-start justify-between gap-3 px-6 pb-[18px] pt-[22px]">
        <div className="min-w-0">
          <h2 className="font-heading text-[19px] font-semibold leading-snug text-slate-900">{title}</h2>
          {sub && <p className="mt-1 text-[12.5px] text-slate-500">{sub}</p>}
        </div>
        {trailing && <div className="shrink-0 text-[13px] text-slate-500">{trailing}</div>}
      </header>
      {children}
    </section>
  );
}

export function DataTable({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <div className="overflow-x-auto">
      <table data-testid={testId} className="list-table w-full border-collapse text-[13.5px]">
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        'whitespace-nowrap border-y border-hairline bg-[#F4EFE4] px-2 py-3 dark:bg-white/[0.05] text-start text-[12px] font-semibold tracking-wide text-slate-500 first:ps-6 last:pe-6',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Tr({ children, className, testId }: { children: ReactNode; className?: string; testId?: string }) {
  return (
    <tr data-testid={testId} className={cn('transition-colors hover:bg-surface-muted/40', className)}>
      {children}
    </tr>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <td className={cn('whitespace-nowrap border-b border-hairline px-2 py-3 align-middle first:ps-6 last:pe-6', className)}>
      {children}
    </td>
  );
}

/** Avatar + name (+ phone) — the person columns. */
export function PersonCell({
  name,
  phone,
  href,
  muted,
}: {
  name: string;
  phone?: string | null;
  href?: string;
  muted?: boolean;
}) {
  const label = (
    <span className={cn('block max-w-[140px] truncate text-[13.5px] font-semibold', muted ? 'text-slate-400' : 'text-slate-900')}>
      {name}
    </span>
  );
  return (
    <div className="flex items-center gap-2.5">
      <Avatar name={name} className="h-8 w-8 text-[11px]" />
      <div className="min-w-0">
        {href ? (
          <Link href={href as never} className="hover:text-brand-700">
            {label}
          </Link>
        ) : (
          label
        )}
        {phone && (
          <span className="mt-0.5 inline-flex items-center gap-1 text-[11.5px] tabular-nums text-slate-500">
            <Phone className="h-3 w-3 shrink-0" />
            <span dir="ltr">{phone}</span>
          </span>
        )}
      </div>
    </div>
  );
}

/** Project photo thumbnail + project name + unit code. */
export function UnitCell({
  cover,
  project,
  unit,
  unitWord,
}: {
  cover?: string | null;
  project?: ReactNode;
  unit?: ReactNode;
  unitWord?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-[34px] w-10 shrink-0 items-center justify-center overflow-hidden rounded-[9px] bg-gradient-to-br from-[#EAD5A3]/60 to-[#9E7A2B]/40">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <Building2 className="h-4 w-4 text-[#8A6823]" />
        )}
      </span>
      <div className="min-w-0">
        <p className="max-w-[140px] truncate text-[13.5px] font-semibold text-slate-900">{project ?? '—'}</p>
        {unit && (
          <p className="mt-0.5 text-[12px] text-slate-500">
            {unitWord && <span className="me-1">{unitWord}</span>}
            <span className="tabular-nums">{unit}</span>
          </p>
        )}
      </div>
    </div>
  );
}

/** A small avatar + name (agents, internal reps). */
export function AgentCell({ name, empty }: { name?: string | null; empty: string }) {
  if (!name) return <span className="text-[12.5px] text-slate-400">{empty}</span>;
  return (
    <div className="flex items-center gap-1.5">
      <Avatar name={name} className="h-[26px] w-[26px] text-[10px]" />
      <span className="max-w-[130px] truncate text-[12.5px] text-slate-800">{name}</span>
    </div>
  );
}

export function DateText({ children }: { children: ReactNode }) {
  return <span className="text-[13px] tabular-nums text-slate-600">{children}</span>;
}
