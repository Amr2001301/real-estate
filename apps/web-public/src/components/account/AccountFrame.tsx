'use client';

import { usePathname } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { PageHero } from '@/components/layout/PageHero';
import { cn } from '@/lib/cn';
import { routes } from '@/lib/routes';

/**
 * The account shell. The welcome band («مرحبًا، …») heads the dashboard only;
 * every inner page starts with its own title beside the menu, so the
 * customer's data is near the top instead of under a repeated banner
 * (owner, 2026-11-12).
 */
export function AccountFrame({
  hero,
  sidebar,
  children,
}: {
  hero: { eyebrow: string; title: string; subtitle: string };
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isHome = pathname === routes.account;
  return (
    <>
      {isHome && <PageHero eyebrow={hero.eyebrow} title={hero.title} subtitle={hero.subtitle} overlap compact />}
      <Container className={cn('relative z-10 pb-20', isHome ? '-mt-14 sm:-mt-16' : 'pt-24 sm:pt-28')}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[284px_minmax(0,1fr)] lg:gap-8">
          {sidebar}
          <div className={cn('min-w-0', isHome ? 'pt-12 md:pt-16 lg:pt-28' : 'pt-2 lg:pt-1')} data-testid="account-content">
            {children}
          </div>
        </div>
      </Container>
    </>
  );
}
