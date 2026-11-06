'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { NAV_ICONS, type IconKey } from '@/lib/nav';
import { NavLink, isNavActive } from './nav-link';

export interface NavSectionView {
  key: string;
  title: string;
  /** The icon on the section's header. */
  iconKey: IconKey;
  flat?: boolean;
  items: { href: string; label: string; iconKey: IconKey; badge?: number; matches?: string[] }[];
}

interface Props {
  sections: NavSectionView[];
  searchPlaceholder: string;
  noResults: string;
  onNavigate?: () => void;
}

const STORAGE_KEY = 'sidebar.openSection';

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function store(key: string | null) {
  try {
    if (key) window.localStorage.setItem(STORAGE_KEY, key);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* a private window: the choice lasts this page only */
  }
}

function Icon({ name }: { name: IconKey }) {
  const C = NAV_ICONS[name];
  return <C aria-hidden className="h-4 w-4" strokeWidth={1.8} />;
}

/**
 * The sidebar's sections: one open at a time, so nine of them fit without
 * scrolling. The section of the page you are on is always the open one; a tap
 * on another opens it and closes the first. Each header says what is inside
 * (an icon, how many pages) and whether something there is waiting (a gold
 * dot while it is closed). A search box finds any page by name (Ctrl/⌘+K).
 * Closed sections keep their links in the page, hidden, so nothing that
 * counts on them changes.
 */
export function NavSections({ sections, searchPlaceholder, noResults, onNavigate }: Props) {
  const pathname = usePathname() ?? '';
  const current = useMemo(
    () => sections.find((s) => !s.flat && s.items.some((i) => isNavActive(pathname, i.href, i.matches)))?.key,
    [sections, pathname],
  );
  const [open, setOpen] = useState<string | null>(current ?? sections.find((s) => !s.flat)?.key ?? null);
  const [query, setQuery] = useState('');
  const input = useRef<HTMLInputElement>(null);

  // The section of this page opens; with no section (a page the menu does not list), the last one left open.
  useEffect(() => {
    if (current) setOpen(current);
    else {
      const stored = readStored();
      if (stored) setOpen(stored);
    }
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
    const next = open === key ? null : key;
    setOpen(next);
    store(next);
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
                icon={<Icon name={i.iconKey} />}
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
            <div key={section.key} className="space-y-1">
              {section.items.map((item) => (
                <NavLink key={item.href} {...item} wide icon={<Icon name={item.iconKey} />} onNavigate={onNavigate} />
              ))}
            </div>
          ) : (
            <Section
              key={section.key}
              section={section}
              isOpen={open === section.key}
              onToggle={() => toggle(section.key)}
              onNavigate={onNavigate}
            />
          ),
        )}
      </div>
    </div>
  );
}

function Section({
  section,
  isOpen,
  onToggle,
  onNavigate,
}: {
  section: NavSectionView;
  isOpen: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const waiting = section.items.some((i) => (i.badge ?? 0) > 0);
  const panel = `nav-panel-${section.key}`;
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panel}
        data-testid="nav-section"
        className={cn(
          'flex h-11 w-full items-center gap-2.5 rounded-xl px-2 text-start text-[14px] transition-colors duration-150',
          'focus-visible:outline-none focus-visible:bg-white/[0.06]',
          isOpen ? 'font-bold text-white' : 'font-medium text-sidebar-text hover:bg-white/[0.04] hover:text-white/90',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors duration-150',
            isOpen ? 'text-[#D8B66A]' : 'text-sidebar-text-muted',
          )}
        >
          <Icon name={section.iconKey} />
        </span>
        <span className="flex-1 truncate">{section.title}</span>
        {!isOpen && waiting && <span aria-hidden className="h-[7px] w-[7px] rounded-full bg-[#D8B66A]" />}
        <ChevronDown
          aria-hidden
          className={cn(
            'h-[15px] w-[15px] shrink-0 text-sidebar-text-muted transition-transform duration-200',
            !isOpen && 'ltr:-rotate-90 rtl:rotate-90',
          )}
        />
      </button>
      <div
        id={panel}
        className={cn('grid transition-[grid-template-rows] duration-200 ease-smooth', isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}
      >
        {/* Closed: hidden for the eye and for tab / screen readers, after the fold has finished. */}
        <div className={cn('overflow-hidden', !isOpen && 'invisible transition-[visibility] delay-200 duration-0')}>
          <div className="ms-[22px] me-1.5 space-y-px border-s border-white/[0.08] py-1 ps-2 pe-1">
            {section.items.map((item) => (
              <NavLink key={item.href} {...item} dense icon={<Icon name={item.iconKey} />} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
