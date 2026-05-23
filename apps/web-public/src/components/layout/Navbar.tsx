'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Route } from 'next';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { PRIMARY_NAV, routes } from '@/lib/routes';
import { SITE } from '@/lib/seo';
import { ButtonLink } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';

function Wordmark({ invert }: { invert: boolean }) {
  return (
    <Link
      href={routes.home}
      className="flex items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60 focus-visible:ring-offset-0"
    >
      <span className="inline-block h-2.5 w-2.5 rounded-full bg-gold-400" aria-hidden />
      <span className={cn('font-display text-xl tracking-tight', invert ? 'text-white' : 'text-navy')}>
        {SITE.name}
      </span>
    </Link>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Only the homepage has a dark hero behind the nav, so it may start
  // transparent. Every other page starts on a light surface, so the nav must
  // be solid immediately — otherwise white links vanish over the light bg.
  const isHome = pathname === '/';
  const solid = !isHome || scrolled || open;

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300 ease-smooth',
        solid ? 'bg-canvas/90 shadow-soft backdrop-blur-md' : 'bg-transparent',
      )}
    >
      <Container className="flex h-20 items-center justify-between py-4">
        <Wordmark invert={!solid} />

        <nav className="hidden items-center gap-1 lg:flex">
          {PRIMARY_NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href as Route}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative px-4 py-2 text-sm font-medium transition-colors duration-200',
                  solid ? 'text-ink-muted hover:text-navy' : 'text-white/80 hover:text-white',
                  active && (solid ? 'text-navy' : 'text-white'),
                )}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-4 -bottom-0.5 h-0.5 rounded-full bg-gold-400" aria-hidden />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="hidden lg:block">
          <ButtonLink href={routes.login} variant={solid ? 'outline' : 'gold'} size="sm">
            تسجيل الدخول
          </ButtonLink>
        </div>

        <button
          type="button"
          aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors lg:hidden',
            solid ? 'text-navy hover:bg-navy/5' : 'text-white hover:bg-white/10',
          )}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </Container>

      {open && <MobileMenu />}
    </header>
  );
}

function MobileMenu() {
  return (
    <div className="lg:hidden">
      <Container className="pb-6 pt-2">
        <nav className="flex flex-col gap-1 rounded-3xl border border-hairline bg-surface p-3 shadow-card">
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href as Route}
              className="rounded-2xl px-4 py-3 text-base font-medium text-navy transition-colors hover:bg-surface-soft"
            >
              {item.label}
            </Link>
          ))}
          <ButtonLink href={routes.login} variant="primary" size="md" className="mt-2 w-full">
            تسجيل الدخول
          </ButtonLink>
        </nav>
      </Container>
    </div>
  );
}
