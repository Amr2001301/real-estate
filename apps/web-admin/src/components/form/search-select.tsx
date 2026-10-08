'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';

export interface SearchOption<T = unknown> {
  id: string;
  label: string;
  raw: T;
}

interface Props<T> {
  /** Form field that receives the selected id. */
  name: string;
  /**
   * List endpoint under /api-proxy, with any fixed filters already in it
   * (e.g. `/api-proxy/users?role=CLIENT,CUSTOMER`). The typed text is sent as
   * `q`; the API does the search, so every record is reachable — not only
   * the first page a server-rendered <select> could hold.
   */
  endpoint: string;
  toOption: (raw: T) => SearchOption<T>;
  onChange?: (raw: T | null) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder: string;
  /** Picks the status texts (no results, searching, clear). */
  locale?: Locale;
  pageSize?: number;
}

const DEBOUNCE_MS = 250;

/**
 * Searchable picker for entities that can number in the thousands (clients,
 * leads, units). Replaces <select>s that were filled from a single
 * `?pageSize=200` fetch, where record 201 could not be chosen at all.
 */
export function SearchSelect<T>({
  name,
  endpoint,
  toOption,
  onChange,
  required,
  disabled,
  placeholder,
  locale = 'ar',
  pageSize = 20,
}: Props<T>) {
  const t = uiT(locale).common;
  const listId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<SearchOption<T>[]>([]);
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<SearchOption<T> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toOptionRef = useRef(toOption);
  toOptionRef.current = toOption;

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      const sep = endpoint.includes('?') ? '&' : '?';
      const q = query.trim();
      const url = `${endpoint}${sep}pageSize=${pageSize}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
      fetch(url, {
        signal: controller.signal,
        credentials: 'include',
        cache: 'no-store',
        // Same shape as the server-side api client (lib/api.ts): translatable
        // fields stay {ar, en}, so callers can read e.g. `project.name.ar`.
        headers: { 'X-Raw-Translatable': '1' },
      })
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .then((body: { data?: T[] }) => {
          setOptions((body.data ?? []).map((raw) => toOptionRef.current(raw)));
          setActive(0);
        })
        .catch((err: unknown) => {
          if ((err as Error).name !== 'AbortError') setOptions([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [endpoint, open, pageSize, query]);

  function choose(option: SearchOption<T>) {
    setSelected(option);
    setQuery('');
    setOpen(false);
    onChange?.(option.raw);
  }

  function clear() {
    setSelected(null);
    setQuery('');
    onChange?.(null);
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(options.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && open) {
      e.preventDefault();
      const option = options[active];
      if (option) choose(option);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      {/* Carries the value into the form and takes part in `required`
          validation; the visible input only drives the search. */}
      <input
        name={name}
        value={selected?.id ?? ''}
        required={required}
        onChange={() => undefined}
        onInvalid={() => inputRef.current?.focus()}
        tabIndex={-1}
        aria-hidden
        className="sr-only"
      />
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        {/* id = name so the surrounding <Field label htmlFor={name}> names
            the combobox. */}
        <input
          ref={inputRef}
          id={name}
          type="text"
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          value={selected && !open ? selected.label : query}
          placeholder={selected ? selected.label : placeholder}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className={cn(
            'block h-10 w-full rounded-xl border border-hairline bg-surface ps-9 pe-9 text-sm text-slate-900 shadow-xs',
            'placeholder:text-slate-400 hover:border-slate-300',
            'focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/15',
            'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60',
          )}
        />
        {loading ? (
          <Loader2 className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
        ) : selected && !disabled ? (
          <button
            type="button"
            onClick={clear}
            aria-label={t.searchClear}
            className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      {open && !disabled && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-hairline bg-surface py-1 shadow-soft"
        >
          {loading && options.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500">{t.searchLoading}</li>
          ) : options.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500">{t.searchNoResults}</li>
          ) : (
            options.map((option, i) => (
              <li
                key={option.id}
                role="option"
                aria-selected={selected?.id === option.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(option);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  'cursor-pointer px-3 py-2 text-sm text-slate-800',
                  i === active && 'bg-brand-50 text-brand-700',
                )}
              >
                {option.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
