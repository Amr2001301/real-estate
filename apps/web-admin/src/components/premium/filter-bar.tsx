'use client';

import {
  Children,
  isValidElement,
  useRef,
  type ChangeEvent,
  type FormHTMLAttributes,
  type ReactNode,
} from 'react';
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
          'flex flex-wrap items-center gap-2.5',
          'rounded-[28px] border border-hairline bg-surface p-2 sm:p-2.5',
          'shadow-[0_10px_30px_-18px_rgb(20_26_38/0.25)]',
          autoSubmit && '[&_button[type=submit]]:hidden',
          className,
        )}
        {...rest}
      >
        {children}
        {trailing && <div className="ms-auto flex shrink-0 flex-wrap items-center gap-2">{trailing}</div>}
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
function isSearch(children: ReactNode): boolean {
  const only = Children.toArray(children)[0];
  return (
    isValidElement<{ type?: string; name?: string }>(only) &&
    (only.props.type === 'search' || (only.props.name === 'q' && (only.props.type ?? 'text') === 'text'))
  );
}

export function PremiumFilterField({ label, htmlFor, children, className, neutral }: PremiumFilterFieldProps) {
  if (isSearch(children)) {
    return (
      <div
        className={cn(
          'relative flex min-w-[220px] flex-1 items-center',
          // The inset ivory search: restyle the Input inside.
          '[&_input]:h-11 [&_input]:w-full [&_input]:rounded-full [&_input]:border-0 [&_input]:bg-surface-sunken/60',
          '[&_input]:ps-11 [&_input]:pe-4 [&_input]:text-[14px] [&_input]:shadow-none [&_input]:ring-0',
          '[&_input]:focus:ring-2 [&_input]:focus:ring-brand-400/40',
          className,
        )}
      >
        <label htmlFor={htmlFor} className="sr-only">{label}</label>
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="pointer-events-none absolute start-4 h-4 w-4 text-slate-400"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4" />
        </svg>
        {children}
      </div>
    );
  }
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        'flex h-11 shrink-0 cursor-pointer items-center gap-1 rounded-full border border-hairline bg-surface ps-4 pe-1',
        'text-[13.5px] text-slate-500 transition-colors hover:border-brand-400/50',
        // Set (a non-empty option chosen) → gold border + gold-soft background.
        !neutral && "has-[option:checked:not([value=''])]:border-brand-400/70 has-[option:checked:not([value=''])]:bg-brand-50",
        // The control inside shows only its value, bold, without its own box.
        '[&_select]:h-9 [&_select]:w-auto [&_select]:min-w-0 [&_select]:border-0 [&_select]:bg-transparent [&_select]:shadow-none',
        '[&_select]:py-0 [&_select]:ps-1 [&_select]:pe-8 [&_select]:text-[13.5px] [&_select]:font-bold [&_select]:text-slate-900',
        '[&_select]:ring-0 [&_select]:focus:ring-0 [&_select]:bg-none [&_select]:appearance-none',
        '[&_input]:h-9 [&_input]:border-0 [&_input]:bg-transparent [&_input]:shadow-none [&_input]:font-bold [&_input]:text-slate-900 [&_input]:focus:ring-0',
        className,
      )}
    >
      <span className="whitespace-nowrap">{label}</span>
      <span className="relative flex items-center">
        {children}
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="pointer-events-none absolute end-3 h-3.5 w-3.5 text-slate-700"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </span>
    </label>
  );
}

/** Status toggle chips with counts (as on inventory). Each chip is a link that sets one URL param. */
export interface FilterChip {
  label: string;
  count?: number;
  href: string;
  active?: boolean;
}

export function PremiumFilterChips({ chips, className }: { chips: FilterChip[]; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {chips.map((c) => (
        <a
          key={c.href}
          href={c.href}
          aria-current={c.active ? 'true' : undefined}
          className={cn(
            'inline-flex h-11 items-center gap-2 rounded-full border ps-1.5 pe-4 text-[13.5px] font-bold transition-colors',
            c.active
              ? 'border-brand-400/70 bg-brand-50 text-brand-700'
              : 'border-hairline bg-surface text-slate-800 hover:border-brand-400/50',
          )}
        >
          {c.count !== undefined && (
            <span
              className={cn(
                'num inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-[15px] font-semibold',
                c.active ? 'bg-brand-100 text-brand-700' : 'bg-surface-muted text-slate-700',
              )}
            >
              {c.count}
            </span>
          )}
          {c.label}
        </a>
      ))}
    </div>
  );
}

/** A thin vertical divider between groups in the bar. */
export function PremiumFilterDivider() {
  return <span aria-hidden className="mx-1 hidden h-7 w-px bg-hairline sm:block" />;
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
