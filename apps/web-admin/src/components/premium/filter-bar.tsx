'use client';

import {
  Children,
  isValidElement,
  useRef,
  type ChangeEvent,
  type FormHTMLAttributes,
  type ReactNode,
} from 'react';
import { ArrowLeft, CalendarRange, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/cn';

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

  return (
    <div className="flex flex-col gap-3">
      <form
        onChange={handleChange}
        className={cn(
          // The one filter bar: ivory glass, a fine gold edge, search first, then the filters.
          'flex flex-wrap items-center gap-y-3 py-2.5 ps-3 pe-3 sm:min-h-[76px] sm:ps-4 sm:pe-3',
          'rounded-card border border-[#D8B66A]/35 bg-gradient-to-b from-surface to-surface-muted/40',
          'shadow-[0_1px_0_rgb(255_255_255/0.7)_inset,0_18px_40px_-22px_rgb(15_30_51/0.35)]',
          autoSubmit && '[&_button[type=submit]]:hidden',
          className,
        )}
        {...rest}
      >
        {children}
        {trailing && <div className="ms-auto flex shrink-0 flex-wrap items-center gap-2 ps-2">{trailing}</div>}
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

export function PremiumFilterField({ label, htmlFor, children, className, neutral }: PremiumFilterFieldProps) {
  if (isSearch(children)) {
    return (
      <div
        className={cn(
          'relative flex min-w-[240px] flex-1 items-center basis-[260px]',
          '[&_input]:h-12 [&_input]:w-full [&_input]:rounded-none [&_input]:border-0 [&_input]:bg-transparent',
          '[&_input]:ps-12 [&_input]:pe-4 [&_input]:text-[15px] [&_input]:shadow-none [&_input]:ring-0',
          '[&_input]:placeholder:text-slate-400 [&_input]:focus:ring-0 [&_input]:focus-visible:ring-0',
          // An Input with its own search icon: ours is the one shown.
          '[&>div>span]:hidden',
          className,
        )}
      >
        <label htmlFor={htmlFor} className="sr-only">{label}</label>
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="pointer-events-none absolute start-3 h-5 w-5 text-brand-700"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        {children}
      </div>
    );
  }
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        // A filter: a small gold caption over its value, a fine fading rule between neighbours.
        'group relative flex min-w-[148px] shrink-0 cursor-pointer flex-col justify-center gap-0.5 px-5 sm:px-6',
        'before:pointer-events-none before:absolute before:inset-y-0 before:end-0 before:my-auto before:hidden before:h-8 before:w-px sm:before:block',
        'before:bg-gradient-to-b before:from-transparent before:via-[#D8B66A]/60 before:to-transparent',
        // The control shows only its value, without its own box.
        '[&_select]:h-7 [&_select]:!w-full [&_select]:min-w-0 [&_select]:border-0 [&_select]:bg-transparent [&_select]:shadow-none',
        '[&_select]:py-0 [&_select]:ps-0 [&_select]:pe-6 [&_select]:text-[15px] [&_select]:font-semibold [&_select]:text-slate-900',
        '[&_select]:ring-0 [&_select]:focus:ring-0 [&_select]:bg-none [&_select]:appearance-none',
        '[&_select]:![box-shadow:none] [&_select:focus]:![box-shadow:none] [&_select:focus-visible]:![box-shadow:none]',
        '[&_input]:h-7 [&_input]:w-full [&_input]:border-0 [&_input]:bg-transparent [&_input]:p-0 [&_input]:text-[15px] [&_input]:shadow-none [&_input]:font-semibold [&_input]:text-slate-900 [&_input]:ring-0 [&_input]:focus:ring-0',
        // One focus cue: the caption turns gold.
        'focus-within:[&>span:first-child]:text-brand-700',
        // Set (a non-empty option chosen): gold caption with a dot, gold value.
        !neutral && "has-[option:checked:not([value=''])]:[&>span:first-child]:text-brand-700 has-[option:checked:not([value=''])]:[&>span:first-child]:after:content-['_•'] has-[option:checked:not([value=''])]:[&_select]:text-brand-700",
        className,
      )}
    >
      <span className="whitespace-nowrap text-[11px] font-semibold tracking-wide text-brand-700/80">{label}</span>
      <span className="relative flex items-center [&:has(input)>svg]:hidden">
        {children}
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="pointer-events-none absolute end-0 h-3.5 w-3.5 text-brand-700"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    </label>
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
        'relative grid h-[52px] w-[52px] shrink-0 place-items-center rounded-2xl text-navy transition-[filter,box-shadow]',
        'bg-gradient-to-br from-[#E9D39A] to-[#C79A3B] shadow-[0_10px_20px_-10px_#C79A3B] hover:brightness-105',
        open && 'ring-2 ring-[#D8B66A]/50 ring-offset-2 ring-offset-surface',
  );
  const inner = (
    <>
      <SlidersHorizontal className="h-[18px] w-[18px]" strokeWidth={1.7} />
      {active && !open && <span aria-hidden className="absolute -end-1 -top-1 h-3 w-3 rounded-full border-2 border-surface bg-navy" />}
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
    <div className="mt-1 w-full basis-full border-t border-[#D8B66A]/30 pt-3">
      <div className="grid grid-cols-2 gap-y-3 sm:grid-cols-3 lg:grid-cols-5 [&>label]:min-w-0">{children}</div>
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
  const set = !!(from.value || to.value);
  const input =
    'h-7 w-[128px] border-0 bg-transparent p-0 text-[14px] font-semibold tabular-nums text-slate-900 focus:outline-none focus:ring-0';
  return (
    <div className="relative flex shrink-0 flex-col justify-center gap-0.5 px-5 sm:px-6 sm:before:absolute sm:before:inset-y-0 sm:before:end-0 sm:before:my-auto sm:before:h-8 sm:before:w-px sm:before:bg-gradient-to-b sm:before:from-transparent sm:before:via-[#D8B66A]/60 sm:before:to-transparent">
      <span className={cn('flex items-center gap-1.5 text-[11px] font-semibold tracking-wide', set ? 'text-brand-700' : 'text-brand-700/80', hideLabel && 'sr-only')}>
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
