import Link from 'next/link';
import type { ReactNode } from 'react';
import { Building2, Phone, Search, ChevronDown, SlidersHorizontal, Filter } from 'lucide-react';
import { cn } from '@/lib/cn';
import { GOLD_ACTION } from '@/components/ui/button';
import { Avatar } from '@/components/cockpit/cockpit';
import type { Locale } from '@/lib/locale';

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
  footer,
  testId,
}: {
  title: string;
  sub?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
  /** Pinned under the table (the pager). */
  footer?: ReactNode;
  testId?: string;
}) {
  return (
    <section
      data-testid={testId}
      className="flex flex-col overflow-clip rounded-[22px] border border-hairline bg-surface shadow-[0_1px_2px_rgb(11_18_32/0.04),0_10px_30px_-10px_rgb(11_18_32/0.08),0_30px_60px_-30px_rgb(11_18_32/0.12)] dark:shadow-none"
    >
      <header className="flex shrink-0 items-start justify-between gap-3 px-6 pb-[18px] pt-[22px]">
        <div className="min-w-0">
          <h2 className="font-heading text-[19px] font-semibold leading-snug text-slate-900">{title}</h2>
          {sub && <p className="mt-1 text-[12.5px] text-slate-500">{sub}</p>}
        </div>
        {trailing && <div className="shrink-0 text-[13px] text-slate-500">{trailing}</div>}
      </header>
      {children}
      {footer}
    </section>
  );
}

/**
 * The page. It scrolls as a whole — the table is never a box with its own
 * hidden up-and-down scroll, and the pager comes right after the last row,
 * where nobody misses it. `minHeight` is accepted for older callers and no
 * longer used.
 */
export function ListPage({ children }: { children: ReactNode; minHeight?: number }) {
  return <div className="flex flex-col gap-5">{children}</div>;
}

/** Underline tabs with a count chip (the visits page). */
export function ListTabs({ items, activeHref }: { items: { label: string; href: string; count?: number }[]; activeHref: string }) {
  return (
    <div role="tablist" className="flex shrink-0 gap-7 overflow-x-auto border-b border-hairline">
      {items.map((it) => {
        const active = it.href === activeHref;
        return (
          <Link
            key={it.href}
            href={it.href as never}
            role="tab"
            aria-selected={active}
            className={cn(
              '-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 pb-3 text-[14px] transition-colors',
              active ? 'border-[#C8A24B] font-semibold text-slate-900' : 'border-transparent font-medium text-slate-500 hover:text-slate-900',
            )}
          >
            {it.label}
            {typeof it.count === 'number' && it.count > 0 && (
              <span
                className={cn(
                  'inline-flex h-5 min-w-[22px] items-center justify-center rounded-full px-1.5 text-[11.5px] font-semibold tabular-nums',
                  active ? 'bg-[#C8A24B]/20 text-[#8A6823] dark:text-[#E2C792]' : 'bg-slate-500/12 text-slate-500',
                )}
              >
                {it.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

export function DataTable({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    // Sideways only: a table wider than its card scrolls left and right with a
    // visible bar under it. It never gets a height of its own, so it never
    // scrolls up and down inside the card — the page does.
    <div className="overflow-x-auto scrollbar-thin">
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
        'sticky top-0 z-10 whitespace-nowrap border-y border-hairline bg-[#F4EFE4] px-2 py-3 last:end-0 last:z-20 text-start text-[12px] font-semibold tracking-wide text-slate-500 first:ps-6 last:pe-6',
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
    // The last column (the row's actions) stays pinned to the end edge, so a
    // table wider than its card never hides its buttons behind a sideways scroll.
    <td className={cn('whitespace-nowrap border-b border-hairline px-2 py-3 align-middle first:ps-6 last:pe-6 last:sticky last:end-0 last:z-[1] last:bg-surface rtl:last:shadow-[10px_0_14px_-12px_rgb(11_18_32/0.28)] ltr:last:shadow-[-10px_0_14px_-12px_rgb(11_18_32/0.28)]', className)}>
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
    <span className={cn('block max-w-[120px] truncate text-[13.5px] font-semibold', muted ? 'text-slate-400' : 'text-slate-900')}>
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
        <p className="max-w-[120px] truncate text-[13.5px] font-semibold text-slate-900">{project ?? '—'}</p>
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

// ── Filter bar (the card with a labelled box per field) ─────────────────────

export function ListFilterBar({
  action,
  children,
  advanced,
  advancedHref,
  onAdvanced,
  advancedLabel,
  submitLabel,
  clearHref,
  clearLabel,
}: {
  action: string;
  children: ReactNode;
  /** The second row of fields, when open. */
  advanced?: ReactNode;
  advancedHref?: string;
  /** For bars that keep the toggle in client state instead of the URL. */
  onAdvanced?: () => void;
  advancedLabel?: string;
  submitLabel: string;
  clearHref?: string;
  clearLabel?: string;
}) {
  return (
    <form
      method="get"
      action={action}
      className="flex shrink-0 flex-wrap items-stretch gap-2.5 rounded-[20px] border border-hairline bg-surface p-3 shadow-[0_1px_2px_rgb(11_18_32/0.04),0_8px_24px_-12px_rgb(11_18_32/0.1)] dark:shadow-none"
    >
      {children}
      {onAdvanced && (
        <button
          type="button"
          onClick={onAdvanced}
          className="inline-flex h-14 items-center gap-2 self-end rounded-[14px] border border-hairline px-[18px] text-[13px] font-semibold text-slate-900 transition-colors hover:border-[#C9A24E]/60"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {advancedLabel}
        </button>
      )}
      {advancedHref && (
        <Link
          href={advancedHref as never}
          className="inline-flex h-14 items-center gap-2 self-end rounded-[14px] border border-hairline px-[18px] text-[13px] font-semibold text-slate-900 transition-colors hover:border-[#C9A24E]/60"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {advancedLabel}
        </Link>
      )}
      {clearHref && (
        <Link
          href={clearHref as never}
          className="inline-flex h-14 items-center self-end rounded-[14px] px-3 text-[13px] font-semibold text-slate-500 hover:text-slate-900"
        >
          {clearLabel}
        </Link>
      )}
      <button
        type="submit"
        className={cn(GOLD_ACTION, 'inline-flex h-14 items-center gap-2 self-end rounded-[14px] px-6 text-[13px]')}
      >
        <Filter className="h-4 w-4" />
        {submitLabel}
      </button>
      {advanced && <div className="grid w-full grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">{advanced}</div>}
    </form>
  );
}

const FIELD_BOX =
  'flex min-w-0 flex-col justify-center gap-1 rounded-[14px] border border-hairline bg-[#F8F5EE] px-4 py-2 dark:bg-white/[0.04]';
const FIELD_CTRL =
  '[&_input]:h-6 [&_input]:w-full [&_input]:border-0 [&_input]:bg-transparent [&_input]:p-0 [&_input]:text-[14px] [&_input]:font-semibold [&_input]:shadow-none [&_input]:ring-0 [&_input]:focus:ring-0 [&_input]:placeholder:font-normal [&_input]:placeholder:text-slate-400 ' +
  '[&_select]:h-6 [&_select]:w-full [&_select]:appearance-none [&_select]:border-0 [&_select]:bg-transparent [&_select]:bg-none [&_select]:p-0 [&_select]:pe-6 [&_select]:text-[14px] [&_select]:font-semibold [&_select]:text-slate-900 [&_select]:shadow-none [&_select]:ring-0 [&_select]:focus:ring-0 ' +
  '[&_input]:text-slate-900';

export function ListFilterField({
  label,
  htmlFor,
  children,
  search,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  search?: boolean;
}) {
  if (search) {
    return (
      <label htmlFor={htmlFor} className={cn(FIELD_BOX, FIELD_CTRL, 'min-w-[260px] flex-1 basis-[280px]')}>
        <span className="text-[11px] font-semibold text-slate-500">{label}</span>
        <span className="flex items-center gap-2">
          <Search className="h-[15px] w-[15px] shrink-0 text-slate-400" />
          {children}
        </span>
      </label>
    );
  }
  return (
    <label htmlFor={htmlFor} className={cn(FIELD_BOX, FIELD_CTRL, 'min-w-[150px]')}>
      <span className="text-[11px] font-semibold text-slate-500">{label}</span>
      <span className="relative flex items-center">
        {children}
        <ChevronDown className="pointer-events-none absolute end-0 h-3.5 w-3.5 text-slate-400" />
      </span>
    </label>
  );
}

// ── Pager (numbered pages, inside the card) ─────────────────────────────────

export function ListPager({
  page,
  pageSize,
  total,
  basePath,
  params,
  locale = 'ar',
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  params?: Record<string, string | undefined>;
  locale?: Locale;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const href = (n: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params ?? {})) if (v) sp.set(k, v);
    sp.set('page', String(n));
    return `${basePath}?${sp.toString()}`;
  };
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  // 1 … around the current page … last
  const set = new Set<number>([1, totalPages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= totalPages));
  const nums = [...set].sort((a, b) => a - b);
  const items: (number | 'gap')[] = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - (nums[i - 1] ?? 0) > 1) items.push('gap');
    items.push(n);
  });
  return (
    <nav
      aria-label="pagination"
      data-testid="list-pager"
      className="flex shrink-0 items-center justify-between gap-3 border-t border-hairline px-6 py-3.5 text-[13px] text-slate-500"
    >
      <p className="tabular-nums">
        {locale === 'en' ? 'Showing' : 'عرض'} {from}–{to} {locale === 'en' ? 'of' : 'من'} {total.toLocaleString(locale === 'en' ? 'en-US' : 'ar-EG-u-nu-latn')}
      </p>
      <div className="flex items-center gap-1.5">
        {items.map((it, i) =>
          it === 'gap' ? (
            <span key={`g${i}`} className="px-1">…</span>
          ) : (
            <Link
              key={it}
              href={href(it) as never}
              aria-current={it === page ? 'page' : undefined}
              className={cn(
                'inline-flex h-[34px] min-w-[34px] items-center justify-center rounded-[10px] px-2 text-[13px] tabular-nums transition-colors',
                it === page ? 'bg-navy text-white' : 'border border-hairline text-slate-600 hover:border-[#C9A24E]/60',
              )}
            >
              {it}
            </Link>
          ),
        )}
      </div>
    </nav>
  );
}

/** The amber strip that appears when something is late. */
export function AlertStrip({ children, action, testId }: { children: ReactNode; action?: ReactNode; testId?: string }) {
  return (
    <div
      data-testid={testId}
      className="flex shrink-0 items-center gap-3.5 rounded-[18px] border border-amber-500/25 bg-amber-500/10 px-[18px] py-3.5 text-[14px] text-slate-900"
    >
      <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700">
        <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}
