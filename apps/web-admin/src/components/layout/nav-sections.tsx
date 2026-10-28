'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { NavLink, isNavActive } from './nav-link';

export interface NavSectionView {
  key: string;
  title: string;
  flat?: boolean;
  items: { href: string; label: string; badge?: number; matches?: string[] }[];
}

interface Props {
  sections: NavSectionView[];
  searchPlaceholder: string;
  noResults: string;
  onNavigate?: () => void;
}

const STORAGE_KEY = 'sidebar.openSections';

function readStored(): string[] | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

function store(keys: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch {
    /* a private window: the choice lasts this page only */
  }
}

/**
 * The sidebar's sections, each opening and closing. The section of the page
 * you are on is always open; the rest stay as you left them. A search box
 * finds any page by name (Ctrl/⌘+K). Closed sections keep their links in the
 * page, hidden, so nothing that counts on them changes.
 */
export function NavSections({ sections, searchPlaceholder, noResults, onNavigate }: Props) {
  const pathname = usePathname() ?? '';
  const current = useMemo(
    () => sections.find((s) => !s.flat && s.items.some((i) => isNavActive(pathname, i.href, i.matches)))?.key,
    [sections, pathname],
  );
  const [open, setOpen] = useState<Set<string>>(() => new Set([current ?? sections.find((s) => !s.flat)?.key ?? '']));
  const [query, setQuery] = useState('');
  const input = useRef<HTMLInputElement>(null);

  // What the user left open last time, plus the section of this page.
  useEffect(() => {
    const stored = readStored();
    setOpen((prev) => new Set([...(stored ?? [...prev]), ...(current ? [current] : [])]));
  }, [current]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function toggle(key: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      store([...next]);
      return next;
    });
  }

  const q = query.trim().toLowerCase();
  const found = q
    ? sections.flatMap((s) => s.items.filter((i) => i.label.toLowerCase().includes(q)).map((i) => ({ ...i, section: s.title })))
    : [];

  return (
    <div className="space-y-3">
      <label className="relative block px-1">
        <Search aria-hidden className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-sidebar-text-muted" />
        <input
          ref={input}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          data-testid="nav-search"
          className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] ps-10 pe-3 text-[13px] text-white placeholder:text-sidebar-text-muted focus:border-[#D8B66A]/50 focus:outline-none"
        />
      </label>

      {q ? (
        <div className="space-y-0.5" data-testid="nav-search-results">
          {found.length === 0 ? (
            <p className="px-3 py-2 text-[12.5px] text-sidebar-text-muted">{noResults}</p>
          ) : (
            found.map((i) => (
              <NavLink
                key={i.href}
                href={i.href}
                label={i.label}
                hint={i.section}
                badge={i.badge}
                matches={i.matches}
                onNavigate={() => {
                  setQuery('');
                  onNavigate?.();
                }}
              />
            ))
          )}
        </div>
      ) : null}

      {/* The sections stay in the page while searching (hidden), so their links stay findable by tests and tools. */}
      <div className={cn('space-y-1', q && 'hidden')}>
        {sections.map((section) =>
          section.flat ? (
            <div key={section.key} className="space-y-0.5 border-t border-white/[0.06] pt-2">
              {section.items.map((item) => (
                <NavLink key={item.href} {...item} onNavigate={onNavigate} />
              ))}
            </div>
          ) : (
            <div key={section.key}>
              <button
                type="button"
                onClick={() => toggle(section.key)}
                aria-expanded={open.has(section.key)}
                data-testid="nav-section"
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[11.5px] font-bold uppercase tracking-[0.12em] text-sidebar-text-muted transition-colors hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
              >
                <span>{section.title}</span>
                <span className="flex items-center gap-2">
                  {!open.has(section.key) && section.items.some((i) => (i.badge ?? 0) > 0) && (
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#D8B66A]" />
                  )}
                  <ChevronDown
                    aria-hidden
                    className={cn('h-3.5 w-3.5 transition-transform duration-150', !open.has(section.key) && 'ltr:-rotate-90 rtl:rotate-90')}
                  />
                </span>
              </button>
              <div className={cn('space-y-0.5 pb-1', !open.has(section.key) && 'hidden')}>
                {section.items.map((item) => (
                  <NavLink key={item.href} {...item} onNavigate={onNavigate} />
                ))}
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
