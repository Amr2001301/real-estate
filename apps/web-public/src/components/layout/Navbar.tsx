'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import type { Route } from 'next';
import { Menu, X, UserCircle2, LogOut } from 'lucide-react';
import { cn } from '@/lib/cn';
import { PRIMARY_NAV, routes } from '@/lib/routes';
import { SITE } from '@/lib/seo';
import { ButtonLink } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { logoutAction } from '@/lib/auth-actions';
import { readClientUser, type ClientUser } from '@/lib/client-user';

/** First name for a light, friendly nav label; falls back to "حسابي". */
function accountLabel(user: ClientUser | null): string {
  const first = user?.fullName?.trim().split(/\s+/)[0];
  return first || 'حسابي';
}

function Wordmark({ invert }: { invert: boolean }) {
  return (
    <Link
      href={routes.home}
      className="flex items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60 focus-visible:ring-offset-0"
    >
      <Image
        src="/brand/devora-logo.png"
        alt={SITE.name}
        width={28}
        height={28}
        priority
        className="h-7 w-7 rounded-md object-cover"
      />
      <span className={cn('font-display text-xl tracking-tight', invert ? 'text-white' : 'text-ink-strong')}>
        {SITE.name}
      </span>
    </Link>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  // UI hint only: read the non-httpOnly `user` cookie AFTER mount so the first
  // client render matches SSR (guest) and no hydration mismatch occurs. Tokens
  // are httpOnly and never read here.
  const [user, setUser] = useState<ClientUser | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
    // Re-read on every navigation so login/logout reflect immediately.
    setUser(readClientUser());
  }, [pathname]);

  // Only the homepage has a dark hero behind the nav, so it may start
  // transparent. Every other page starts on a light surface, so the nav must
  // be solid immediately — otherwise white links vanish over the light bg.
  const isHome = pathname === '/';
  const solid = !isHome || scrolled || open;

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 border-b transition-all duration-300 ease-smooth',
        solid ? 'border-hairline bg-canvas/90 shadow-soft backdrop-blur-md' : 'border-transparent bg-transparent',
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
                  'relative rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200',
                  solid ? 'text-ink-muted hover:bg-navy/[0.05] hover:text-ink-strong' : 'text-white/80 hover:bg-white/10 hover:text-white',
                  active && (solid ? 'text-ink-strong' : 'text-white'),
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

        <div className="hidden items-center gap-4 lg:flex">
          <ThemeToggle
            className={cn(
              'rounded-lg',
              solid ? 'text-ink-muted hover:bg-surface-soft' : 'text-white/80 hover:bg-white/10 hover:text-white',
            )}
          />
          {user ? (
            <>
              {/* User account capsule — name + micro initials avatar */}
              <Link
                href={routes.account}
                className={cn(
                  'flex items-center gap-2 rounded-full border py-1 pe-2 ps-3 transition-all duration-200',
                  solid
                    ? 'border-hairline/60 bg-surface-soft hover:bg-hairline/40'
                    : 'border-white/15 bg-white/10 hover:bg-white/15',
                )}
              >
                <span className={cn('text-xs font-bold', solid ? 'text-ink-strong' : 'text-white')}>
                  {accountLabel(user)}
                </span>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gold-100 text-[10px] font-black text-gold-600">
                  {(user.fullName.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('') || '؟').toUpperCase()}
                </span>
              </Link>
              {/* Premium logout button */}
              <form action={logoutAction}>
                <button
                  type="submit"
                  aria-label="تسجيل الخروج"
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all duration-200',
                    solid
                      ? 'border-error/20 bg-error/10 text-error hover:bg-error/15'
                      : 'border-white/15 bg-white/10 text-white/90 hover:bg-error/30 hover:text-white',
                  )}
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                  خروج
                </button>
              </form>
            </>
          ) : (
            <ButtonLink href={routes.login} variant={solid ? 'outline' : 'gold'} size="sm">
              تسجيل الدخول
            </ButtonLink>
          )}
        </div>

        <div className="flex items-center gap-1 lg:hidden">
          <ThemeToggle className={cn(!solid && 'text-white/80 hover:bg-white/10 hover:text-white')} />
          <button
            type="button"
            aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className={cn(
              'inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors',
              solid ? 'text-ink-strong hover:bg-navy/5' : 'text-white hover:bg-white/10',
            )}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </Container>

      {open && <MobileMenu user={user} />}
    </header>
  );
}

function MobileMenu({ user }: { user: ClientUser | null }) {
  return (
    <div className="lg:hidden">
      <Container className="pb-6 pt-2">
        <nav className="flex flex-col gap-1 rounded-3xl border border-hairline bg-surface p-3 shadow-card">
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href as Route}
              className="rounded-2xl px-4 py-3 text-base font-medium text-ink-strong transition-colors hover:bg-surface-soft"
            >
              {item.label}
            </Link>
          ))}
          {user ? (
            <>
              <Link
                href={routes.account}
                className="mt-1 inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-base font-medium text-ink-strong transition-colors hover:bg-surface-soft"
              >
                <UserCircle2 className="h-5 w-5" aria-hidden />
                {accountLabel(user)}
              </Link>
              <form action={logoutAction} className="mt-1">
                <button
                  type="submit"
                  className="inline-flex w-full items-center gap-2 rounded-2xl px-4 py-3 text-base font-medium text-ink-muted transition-colors hover:bg-surface-soft"
                >
                  <LogOut className="h-5 w-5" aria-hidden />
                  تسجيل الخروج
                </button>
              </form>
            </>
          ) : (
            <ButtonLink href={routes.login} variant="primary" size="md" className="mt-2 w-full">
              تسجيل الدخول
            </ButtonLink>
          )}
        </nav>
      </Container>
    </div>
  );
}
