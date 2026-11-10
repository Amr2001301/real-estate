'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { X, Images } from 'lucide-react';
import { CoverImage } from '@/components/ui/CoverImage';
import { useSiteLocale } from '@/components/locale/SiteLocaleProvider';
import { extraT } from '@/messages/site-extra';

/**
 * The top of a unit or project page: the main photo full-width with the
 * title, place and actions over it, a few thumbnails at the far corner and
 * a full-screen viewer for every photo. No photo → the building drawing.
 */
export function DetailHero({
  images,
  alt,
  chips,
  title,
  subtitle,
  actions,
  tools,
}: {
  images: string[];
  alt: string;
  chips?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Save / share, at the top corner. */
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
  const num = new Intl.NumberFormat('en-US').format(count);

  return (
    <div className="relative isolate overflow-hidden rounded-[1.75rem] text-white" style={{ height: 'clamp(500px, 54vw, 660px)' }}>
      <CoverImage src={images[0]} alt={alt} className="absolute inset-0 -z-10 h-full" />
      <span className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(0deg,rgba(0,0,0,.86)_0%,rgba(0,0,0,.5)_34%,rgba(0,0,0,.08)_62%,rgba(0,0,0,.25)_100%)]" aria-hidden />

      {tools && <div className="absolute end-4 top-4 flex items-center gap-2 sm:end-6 sm:top-6">{tools}</div>}

      <div className="absolute inset-x-5 bottom-[4.5rem] sm:inset-x-9 sm:bottom-[5.25rem] lg:end-[22rem]">
        {chips && <div className="flex flex-wrap gap-2">{chips}</div>}
        <h1 className="mt-4 font-display text-[2rem] font-semibold leading-[1.3] text-white sm:text-[2.9rem]">{title}</h1>
        {subtitle && <div className="mt-2 text-[15px] text-white/85 sm:text-base">{subtitle}</div>}
        {actions && <div className="mt-6 flex flex-wrap items-center gap-3">{actions}</div>}
      </div>

      {count > 1 && (
        <div className="absolute bottom-[5.25rem] end-9 hidden items-end gap-2.5 lg:flex">
          {thumbs.map((u, i) => (
            <button
              key={`${u}-${i}`}
              type="button"
              onClick={() => setOpen(i + 1)}
              aria-label={`${alt} — ${i + 2}`}
              className="h-20 w-28 overflow-hidden rounded-xl ring-2 ring-white/70 transition-transform hover:-translate-y-0.5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {count > 1 && (
        <button
          type="button"
          onClick={() => setOpen(0)}
          className="absolute end-4 top-[4.25rem] inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-[#1A1F1C] shadow-lg backdrop-blur hover:bg-white sm:end-6 sm:top-20 lg:bottom-[11rem] lg:end-9 lg:top-auto"
        >
          <Images className="h-4 w-4" aria-hidden />
          {t.photos(num)}
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
