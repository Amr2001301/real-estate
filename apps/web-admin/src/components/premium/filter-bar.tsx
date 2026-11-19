'use client';

import {
  Children,
  isValidElement,
  useRef,
  type ChangeEvent,
  type FormHTMLAttributes,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ArrowLeft, CalendarRange, Filter, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/cn';
import { GOLD_ACTION } from '@/components/ui/button';
import { ListFilterField } from '@/components/lists/list-kit';
import { useClientLocale } from '@/components/locale-provider';

export interface PremiumFilterBarProps extends FormHTMLAttributes<HTMLFormElement> {
  /** Filter fields (search input, selects, chips) */
  children: ReactNode;
  /** Trailing cluster pushed to the end (more filters, view toggle, export) */
  trailing?: ReactNode;
  /**
   * Submit as soon as a field changes (U5: no "Apply" button). Selects,
   * dates and checkboxes submit at once; typing in a search box submits
   * after a short pause. Submit buttons inside the bar are hidden.
   */
  autoSubmit?: boolean;
  /** Under the bar: result count, active filters, "clear all". */
  summary?: ReactNode;
}

const TYPING_DELAY_MS = 450;

/**
 * The one filter bar (U5): a pill-shaped bar with an inset search, filters as
 * `label · value` pills (gold when set), then a trailing cluster. It stays a
 * GET form, so filters live in the URL as before.
 */
export function PremiumFilterBar({
  children,
  trailing,
  autoSubmit = true,
  summary,
  className,
  onChange,
  ...rest
}: PremiumFilterBarProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(e: ChangeEvent<HTMLFormElement>) {
    onChange?.(e);
    if (!autoSubmit) return;
    const form = e.currentTarget;
    const field = e.target as unknown as HTMLInputElement;
    if (timer.current) clearTimeout(timer.current);
    const typing = field.tagName === 'INPUT' && /^(search|text|number|tel|email)$/.test(field.type);
    if (typing) {
      timer.current = setTimeout(() => form.requestSubmit(), TYPING_DELAY_MS);
    } else {
      form.requestSubmit();
    }
  }

  const locale = useClientLocale();
  const pathname = usePathname();
  const params = useSearchParams();
  // Anything set in the URL (bar the page number and the open/closed toggle) can be cleared.
  const hasFilters = [...params.keys()].some((k) => k !== 'page' && k !== 'showFilters' && k !== 'view');
  const ar = locale !== 'en';

  return (
    <div className="flex flex-col gap-3">
      <form
        onChange={handleChange}
        className={cn(
          // The one filter bar, the same on every list: a card, a labelled box per field
          // (the search first), a clear link and the gold «تصفية» button.
          'flex flex-wrap items-stretch gap-2.5 rounded-[20px] border border-hairline bg-surface p-3',
          'shadow-[0_1px_2px_rgb(11_18_32/0.04),0_8px_24px_-12px_rgb(11_18_32/0.1)] dark:shadow-none',
          // A page's own submit button is hidden: the bar has the one gold button.
          '[&_button[type=submit]:not([data-filter-submit])]:hidden [&_a:has(>button[type=button])]:hidden',
          // Pages put their second row of filters in a full-width block: it goes under the first row, after the buttons.
          '[&>.basis-full]:order-[9]',
          className,
        )}
        {...rest}
      >
        {children}
        {trailing && <div className="order-[4] flex shrink-0 items-end gap-2.5 self-end">{trailing}</div>}
        {hasFilters && (
          <Link
            href={pathname as never}
            className="order-[5] inline-flex h-14 items-center self-end rounded-[14px] px-3 text-[13px] font-semibold text-slate-500 hover:text-slate-900"
          >
            {ar ? 'مسح' : 'Clear'}
          </Link>
        )}
        <button type="submit" data-filter-submit className={cn(GOLD_ACTION, 'order-[5] inline-flex h-14 items-center gap-2 self-end rounded-[14px] px-6 text-[13px]')}>
          <Filter className="h-4 w-4" />
          {ar ? 'تصفية' : 'Filter'}
        </button>
      </form>
      {summary && <div className="flex flex-wrap items-center gap-3 px-2 text-[13px] text-slate-500">{summary}</div>}
    </div>
  );
}

/** A field in the bar. A search input becomes the inset search; anything else a `label · value` pill. */
export interface PremiumFilterFieldProps {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
  /** Always has a value (a year, a month): never shown as an active filter. */
  neutral?: boolean;
}

/** The page's free-text search: an input of type "search", or the `q` field. */
function firstInput(node: ReactNode, depth = 0): { type?: string; name?: string } | null {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ type?: string; name?: string; children?: ReactNode }>(child)) continue;
    if (child.type === 'input' || child.props.type !== undefined || child.props.name !== undefined) return child.props;
    if (depth < 3) {
      const inner = firstInput(child.props.children, depth + 1);
      if (inner) return inner;
    }
  }
  return null;
}

function isSearch(children: ReactNode): boolean {
  const input = firstInput(children);
  if (!input) return false;
  if (input.type === 'search') return true;
  return !!input.name && ['q', 'search', 'query'].includes(input.name) && (input.type ?? 'text') === 'text';
}

export function PremiumFilterField({ label, htmlFor, children, className: _className, neutral: _neutral }: PremiumFilterFieldProps) {
  // Same box as the reservations and contracts bars: caption over the value; the search is the wide one.
  return (
    <ListFilterField label={label} htmlFor={htmlFor} search={isSearch(children)}>
      {/* An Input with its own search icon: the field's is the one shown. */}
      <span className="contents [&>div>span]:hidden">{children}</span>
    </ListFilterField>
  );
}

/** A thin vertical divider between groups in the bar. */
export function PremiumFilterDivider() {
  return null;
}

/**
 * The gold square at the end of the bar that opens/closes the advanced filters. A link, because the
 * pages keep that state in the URL (`showFilters`). `active` shows a dot when an advanced filter is set.
 */
export function PremiumFilterAdvancedToggle({
  href,
  onClick,
  open,
  active,
  label,
}: {
  /** A link (the URL keeps the state), or `onClick` for a bar that keeps it in the page. */
  href?: string;
  onClick?: () => void;
  open: boolean;
  active?: boolean;
  /** The text for screen readers and the tooltip. */
  label: string;
}) {
  const cls = cn(
    'relative inline-flex h-14 shrink-0 items-center gap-2 self-end rounded-[14px] border border-hairline px-[18px] text-[13px] font-semibold text-slate-900 transition-colors hover:border-[#C9A24E]/60',
    open && 'border-[#C8A24B] ring-1 ring-[#C8A24B]/50',
  );
  const inner = (
    <>
      <SlidersHorizontal className="h-4 w-4" strokeWidth={1.8} />
      <span className="hidden sm:inline">{label}</span>
      {active && !open && <span aria-hidden className="absolute -end-1 -top-1 h-3 w-3 rounded-full border-2 border-surface bg-[#C8A24B]" />}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} aria-label={label} title={label} aria-expanded={open} className={cls}>
      {inner}
    </button>
  ) : (
    <a href={href} aria-label={label} title={label} aria-expanded={open} className={cls}>
      {inner}
    </a>
  );
}

/** The advanced filters: a second row under the bar, the same fields in a quiet grid. */
export function PremiumFilterAdvancedPanel({ children }: { children: ReactNode }) {
  return (
    <div className="order-[9] w-full basis-full">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 [&>label]:min-w-0">{children}</div>
    </div>
  );
}

/** Table / cards (/ kanban) switch. Each option is a link carrying the page's own `view` param. */
export interface ViewOption {
  key: string;
  label: string;
  icon: ReactNode;
  href: string;
}

export function PremiumViewToggle({ options, current }: { options: ViewOption[]; current: string }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-surface-sunken/60 p-1">
      {options.map((o) => {
        const active = o.key === current;
        return (
          <a
            key={o.key}
            href={o.href}
            aria-label={o.label}
            title={o.label}
            aria-current={active ? 'true' : undefined}
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors [&_svg]:h-4 [&_svg]:w-4',
              active ? 'bg-surface text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800',
            )}
          >
            {o.icon}
          </a>
        );
      })}
    </div>
  );
}

/** A date range as one pill: "label  [from] → [to]", gold when either end is set. */
export function PremiumRangeField({
  label,
  from,
  to,
  hideLabel,
}: {
  label: string;
  hideLabel?: boolean;
  from: { id: string; value?: string; label: string };
  to: { id: string; value?: string; label: string };
}) {
  const input =
    'h-6 w-[116px] border-0 bg-transparent p-0 text-[14px] font-semibold tabular-nums text-slate-900 focus:outline-none focus:ring-0';
  return (
    <div className="flex min-w-[150px] shrink-0 flex-col justify-center gap-1 rounded-[14px] border border-hairline bg-[#F8F5EE] px-4 py-2 dark:bg-white/[0.04]">
      <span className={cn('flex items-center gap-1.5 text-[11px] font-semibold text-slate-500', hideLabel && 'sr-only')}>
        <CalendarRange className="h-3 w-3" />
        {label}
      </span>
      <span className="flex items-center gap-2">
        <label htmlFor={from.id} className="sr-only">{from.label}</label>
        <input id={from.id} name={from.id} type="date" defaultValue={from.value ?? ''} className={input} />
        <ArrowLeft className="h-3 w-3 shrink-0 text-slate-400 ltr:rotate-180" aria-hidden />
        <label htmlFor={to.id} className="sr-only">{to.label}</label>
        <input id={to.id} name={to.id} type="date" defaultValue={to.value ?? ''} className={input} />
      </span>
    </div>
  );
}
