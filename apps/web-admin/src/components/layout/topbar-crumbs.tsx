'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home } from 'lucide-react';
import { isNavActive } from './nav-link';

export interface CrumbSection {
  title: string;
  items: { href: string; label: string; matches?: string[] }[];
}

/**
 * Where you are, read from the menu: the section, then the page (the longest
 * menu link that matches the address). Nothing extra on pages the menu does not list.
 */
export function TopbarCrumbs({ sections, home }: { sections: CrumbSection[]; home: { href: string; label: string } }) {
  const pathname = usePathname() ?? '';
  let best: { section: string; label: string; href: string; len: number } | null = null;
  for (const s of sections) {
    for (const i of s.items) {
      if (isNavActive(pathname, i.href, i.matches) && (!best || i.href.length > best.len)) {
        best = { section: s.title, label: i.label, href: i.href, len: i.href.length };
      }
    }
  }
  const crumbs = best ? (best.section && best.section !== best.label ? [best.section, best.label] : [best.label]) : [];
  return (
    <nav aria-label="breadcrumb" className="hidden min-w-0 items-center gap-2 text-[13px] md:flex">
      <Link href={home.href as never} aria-label={home.label} className="text-slate-500 hover:text-slate-900">
        <Home className="h-[15px] w-[15px]" aria-hidden />
      </Link>
      {crumbs.map((c, i) => (
        <span key={i} className="flex min-w-0 items-center gap-2">
          <span aria-hidden className="text-slate-500">/</span>
          <span className={i === crumbs.length - 1 ? 'truncate font-semibold text-slate-900' : 'truncate text-slate-500'}>{c}</span>
        </span>
      ))}
    </nav>
  );
}
