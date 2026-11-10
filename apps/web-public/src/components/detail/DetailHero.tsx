'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { X, Images } from 'lucide-react';
import { CoverImage } from '@/components/ui/CoverImage';
import { useSiteLocale } from '@/components/locale/SiteLocaleProvider';
import { extraT } from '@/messages/site-extra';

/**
 * The top of a unit or project page: the main photo full-width with only
 * the place and the name over it, three thumbnails (the last «+N») at the
 * far corner and a full-screen viewer. No photo → the building drawing.
 */
export function DetailHero({
  images,
  alt,
  status,
  eyebrow,
  title,
  tools,
}: {
  images: string[];
  alt: string;
  /** One chip at the top corner (available, featured…). */
  status?: ReactNode;
  /** The line above the title: project and place. */
  eyebrow?: string;
  title: string;
  /** Save / compare / share, at the other top corner. */
  tools?: ReactNode;
}) {
  const t = extraT(useSiteLocale()).unitPage;
  const [open, setOpen] = useState<number | null>(null);
  const count = images.length;

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const step = (e.key === 'ArrowLeft') === (document.documentElement.dir === 'rtl') ? 1 : -1;
        setOpen((i) => (i === null ? i : (i + step + count) % count));
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, count]);

  const thumbs = images.slice(1, 4);
  const more = count - 1 - thumbs.length;
  const num = new Intl.NumberFormat('en-US').format(count);

  return (
    <div className="relative isolate overflow-hidden rounded-[1.75rem] text-white" style={{ height: 'clamp(460px, 48vw, 600px)' }}>
      <button type="button" onClick={() => count && setOpen(0)} className="absolute inset-0 -z-10 block h-full w-full cursor-zoom-in" aria-label={alt} tabIndex={count ? 0 : -1}>
        <CoverImage src={images[0]} alt={alt} className="h-full" />
      </button>
      <span className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(0deg,rgba(0,0,0,.78)_0%,rgba(0,0,0,.35)_30%,rgba(0,0,0,0)_55%)]" aria-hidden />
      <span className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-32 bg-[linear-gradient(180deg,rgba(0,0,0,.35),transparent)]" aria-hidden />

      {status && <div className="absolute start-5 top-5 sm:start-7 sm:top-7">{status}</div>}
      {tools && <div className="absolute end-5 top-5 flex items-center gap-2 sm:end-7 sm:top-7">{tools}</div>}

      <div className="pointer-events-none absolute inset-x-6 bottom-[4.25rem] sm:inset-x-10 sm:bottom-[5rem] lg:end-[24rem]">
        {eyebrow && <p className="text-[15px] font-medium text-white/80">{eyebrow}</p>}
        <h1 className="mt-1.5 font-display text-[2.1rem] font-semibold leading-[1.25] text-white sm:text-[3.1rem]">{title}</h1>
      </div>

      {count > 1 && (
        <div className="absolute bottom-[5rem] end-10 hidden gap-2 lg:flex">
          {thumbs.map((u, i) => {
            const last = i === thumbs.length - 1;
            return (
              <button
                key={`${u}-${i}`}
                type="button"
                onClick={() => setOpen(last && more > 0 ? 0 : i + 1)}
                aria-label={last && more > 0 ? t.photos(num) : `${alt} — ${i + 2}`}
                className="relative h-[72px] w-24 overflow-hidden rounded-xl ring-1 ring-white/40 transition-transform hover:-translate-y-0.5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" className="h-full w-full object-cover" />
                {last && more > 0 && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/55 font-display text-lg font-semibold text-white" dir="ltr">+{more}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
      {count > 1 && (
        <button
          type="button"
          onClick={() => setOpen(0)}
          className="absolute bottom-[5rem] end-6 inline-flex h-10 items-center gap-2 rounded-full bg-black/45 px-4 text-sm font-medium text-white ring-1 ring-white/25 backdrop-blur lg:hidden"
        >
          <Images className="h-4 w-4" aria-hidden />
          {num}
        </button>
      )}

      {open !== null && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-black/95 p-4 sm:p-8" role="dialog" aria-modal="true" aria-label={alt}>
          <button
            type="button"
            onClick={() => setOpen(null)}
            aria-label={t.close}
            className="mb-3 ms-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
          <div className="relative min-h-0 flex-1" onClick={() => setOpen(null)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images[open]} alt={`${alt} — ${open + 1}`} className="mx-auto h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
          </div>
          <div className="mt-3 flex justify-center gap-2 overflow-x-auto pb-1">
            {images.map((u, i) => (
              <button
                key={`${u}-${i}`}
                type="button"
                onClick={() => setOpen(i)}
                aria-label={`${alt} — ${i + 1}`}
                className={`h-14 w-20 shrink-0 overflow-hidden rounded-lg ring-2 ${i === open ? 'ring-gold-400' : 'opacity-60 ring-transparent'}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** A frosted chip on the hero photo. */
export function HeroChip({ children, tone = 'glass' }: { children: ReactNode; tone?: 'glass' | 'gold' | 'success' }) {
  const cls =
    tone === 'gold'
      ? 'bg-gold-400 text-[#1B1206]'
      : tone === 'success'
        ? 'bg-emerald-500/90 text-white'
        : 'bg-white/[0.16] text-white ring-1 ring-white/25 backdrop-blur';
  return <span className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

/** A round frosted button on the hero photo (save, compare, share). */
export const heroIconClass =
  'inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white ring-1 ring-white/25 backdrop-blur transition-colors hover:bg-black/55';
