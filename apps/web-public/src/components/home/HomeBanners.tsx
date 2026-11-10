'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { cn } from '@/lib/cn';
import { isExternalLink, type PublicBanner } from '@/lib/cms';
import type { Locale } from '@/lib/locale';
import { siteT } from '@/messages/site';

const ROTATE_MS = 6000;

/**
 * The company's active banners (dashboard → «المحتوى» → البانرات) as a strip
 * that turns every few seconds; hover or focus holds it. Nothing renders when
 * the company has none.
 */
export function HomeBanners({ banners, locale }: { banners: PublicBanner[]; locale: Locale }) {
  const m = siteT(locale).home.promos;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = banners.length;

  const go = useCallback((n: number) => setIndex(((n % count) + count) % count), [count]);

  useEffect(() => {
    if (count < 2 || paused) return;
    // Respect a visitor who asked for less motion.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => window.clearInterval(t);
  }, [count, paused]);

  if (count === 0) return null;
  const rtl = locale === 'ar';

  return (
    <Container className="pt-16 sm:pt-20">
      <section
        aria-roledescription="carousel"
        aria-label={m.label}
        data-testid="home-banners"
        className="relative overflow-hidden rounded-[1.75rem] bg-navy"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <div className="relative aspect-[16/9] sm:aspect-[16/6]">
          {banners.map((b, i) => {
            const slide = (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.imageUrl} alt="" className="h-full w-full object-cover" loading={i === 0 ? 'eager' : 'lazy'} />
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: `linear-gradient(to ${rtl ? 'left' : 'right'}, color-mix(in srgb, rgb(var(--c-navy)) 50%, black) 0%, color-mix(in srgb, color-mix(in srgb, rgb(var(--c-navy)) 50%, black) 65%, transparent) 50%, transparent 100%)`,
                  }}
                  aria-hidden
                />
                {b.title && (
                  <p className="absolute bottom-0 start-0 max-w-xl p-6 font-display text-xl font-semibold leading-[1.55] text-white sm:p-10 sm:text-[1.875rem] lg:text-[2.25rem]">{b.title}</p>
                )}
              </>
            );
            const shown = i === index;
            const cls = cn('absolute inset-0 block transition-opacity duration-700', shown ? 'opacity-100' : 'pointer-events-none opacity-0');
            const common = {
              className: cls,
              'aria-hidden': !shown,
              tabIndex: shown ? undefined : -1,
              'aria-roledescription': 'slide',
              'aria-label': `${i + 1} / ${count}`,
            } as const;
            if (!b.link) return <div key={b.id} {...common}>{slide}</div>;
            return isExternalLink(b.link) ? (
              <a key={b.id} href={b.link} target="_blank" rel="noopener noreferrer" {...common}>{slide}</a>
            ) : (
              <Link key={b.id} href={b.link as Route} {...common}>{slide}</Link>
            );
          })}
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label={m.prev}
              className="absolute start-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur transition-colors hover:bg-black/55"
            >
              {rtl ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label={m.next}
              className="absolute end-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur transition-colors hover:bg-black/55"
            >
              {rtl ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </button>
            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
              {banners.map((b, i) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={m.goTo(i + 1)}
                  aria-current={i === index ? 'true' : undefined}
                  className={cn('h-2 rounded-full transition-all', i === index ? 'w-6 bg-gold-300' : 'w-2 bg-white/50 hover:bg-white/80')}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </Container>
  );
}
