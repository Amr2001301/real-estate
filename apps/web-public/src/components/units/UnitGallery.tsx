'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { PublicMedia } from '@/lib/api-types';
import { CoverImage } from '@/components/ui/CoverImage';
import { extraT } from '@/messages/site-extra';
import type { Locale } from '@/lib/locale';

/**
 * The unit's photos: one large with four small beside it, and «عرض كل الصور»
 * opening every photo in a full-screen viewer. Only photos — the floor plan
 * has its own section.
 */
export function UnitGallery({ media, alt, locale }: { media: PublicMedia[]; alt: string; locale: Locale }) {
  const t = extraT(locale).unitPage;
  const images = media.filter((m) => m.type === 'IMAGE' || !m.type).map((m) => m.url);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const dir = (e.key === 'ArrowRight') === (document.dir === 'rtl') ? -1 : 1;
        setOpen((i) => (i === null ? i : (i + dir + images.length) % images.length));
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, images.length]);

  const [main, ...rest] = images;
  const small = rest.slice(0, 4);
  const num = new Intl.NumberFormat('en-US').format(images.length);

  return (
    <div className="relative">
      <div className={small.length > 0 ? 'grid gap-3 lg:h-[500px] lg:grid-cols-[1.6fr_1fr]' : ''}>
        <button
          type="button"
          onClick={() => images.length && setOpen(0)}
          className={`group relative block w-full overflow-hidden rounded-[1.5rem] ${small.length > 0 ? 'h-[300px] sm:h-[400px] lg:h-full' : 'h-[300px] sm:h-[420px] lg:h-[500px]'}`}
          aria-label={alt}
        >
          <CoverImage src={main} alt={alt} className="h-full w-full" zoomOnHover />
        </button>
        {small.length > 0 && (
          <div className="grid h-40 grid-cols-4 gap-3 sm:h-52 lg:h-full lg:grid-cols-2 lg:grid-rows-2">
            {small.map((u, i) => (
              <button
                key={`${u}-${i}`}
                type="button"
                onClick={() => setOpen(i + 1)}
                className="group relative block overflow-hidden rounded-2xl"
                aria-label={`${alt} — ${i + 2}`}
              >
                <CoverImage src={u} alt={`${alt} — ${i + 2}`} className="h-full w-full" zoomOnHover />
              </button>
            ))}
          </div>
        )}
      </div>
      {images.length > 1 && (
        <button
          type="button"
          onClick={() => setOpen(0)}
          className="absolute bottom-4 end-4 rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-[#1A1F1C] shadow-lg ring-1 ring-black/5 backdrop-blur transition-colors hover:bg-white"
        >
          {t.photos(num)}
        </button>
      )}

      {open !== null && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-black/92 p-4 sm:p-8" role="dialog" aria-modal="true" aria-label={alt}>
          <button
            type="button"
            onClick={() => setOpen(null)}
            aria-label={t.close}
            className="ms-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
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
                className={`h-14 w-20 shrink-0 overflow-hidden rounded-lg ring-2 ${i === open ? 'ring-gold-400' : 'ring-transparent opacity-60'}`}
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
