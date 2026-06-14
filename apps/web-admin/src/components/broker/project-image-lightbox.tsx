'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Building2 } from 'lucide-react';

interface MediaItem {
  id: string;
  url: string;
  type: string;
}

interface Props {
  media: MediaItem[];
  projectName: string;
}

export function ProjectImageLightbox({ media, projectName }: Props) {
  const [open, setOpen]       = useState(false);
  const [current, setCurrent] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Prefer IMAGE type; fall back to any media
  const photos = media.filter((m) => m.type === 'IMAGE');
  const gallery = photos.length > 0 ? photos : media;
  const cover   = gallery[0];
  const multi   = gallery.length > 1;

  const close = useCallback(() => setOpen(false), []);
  const prev  = useCallback(() => setCurrent((i) => (i - 1 + gallery.length) % gallery.length), [gallery.length]);
  const next  = useCallback(() => setCurrent((i) => (i + 1) % gallery.length), [gallery.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')     close();
      if (e.key === 'ArrowLeft')  prev();
      if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close, prev, next]);

  // ── Thumbnail (rendered inside card image container) ─────────────────────
  return (
    <>
      {cover ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover.url}
            alt={projectName}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {/* Transparent click-to-preview overlay */}
          <button
            type="button"
            onClick={() => { setCurrent(0); setOpen(true); }}
            className="absolute inset-0 z-10 cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset"
            aria-label={`معاينة صور ${projectName}`}
          />
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <Building2 className="h-8 w-8 text-brand-200" />
        </div>
      )}

      {/* ── Lightbox portal ───────────────────────────────────────────────── */}
      {mounted && open && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label={`معرض صور ${projectName}`}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/88 backdrop-blur-sm"
            onClick={close}
            aria-hidden="true"
          />

          {/* Close button */}
          <button
            type="button"
            onClick={close}
            className="absolute top-4 end-4 z-20 h-9 w-9 rounded-full bg-white/10 hover:bg-white/22 flex items-center justify-center text-white transition-colors"
            aria-label="إغلاق المعرض"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Counter */}
          {multi && (
            <p className="absolute top-4 start-4 z-20 text-white/65 text-sm font-medium tabular-nums select-none">
              {current + 1} / {gallery.length}
            </p>
          )}

          {/* Active image */}
          <div
            className="relative z-10 mx-6 max-w-4xl max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={gallery[current]?.id}
              src={gallery[current]?.url ?? cover?.url}
              alt={`${projectName} — صورة ${current + 1}`}
              className="block max-h-[85vh] max-w-full object-contain"
            />
          </div>

          {/* Prev / Next arrows (physical left/right, gallery convention) */}
          {multi && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-4 z-20 h-10 w-10 rounded-full bg-white/10 hover:bg-white/22 flex items-center justify-center text-white transition-colors"
                aria-label="الصورة السابقة"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-4 z-20 h-10 w-10 rounded-full bg-white/10 hover:bg-white/22 flex items-center justify-center text-white transition-colors"
                aria-label="الصورة التالية"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          {/* Dot / pill indicator strip */}
          {multi && (
            <div className="absolute bottom-4 z-20 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
              {gallery.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
                  className={`rounded-full transition-all ${
                    i === current
                      ? 'w-5 h-1.5 bg-white'
                      : 'w-1.5 h-1.5 bg-white/35 hover:bg-white/65'
                  }`}
                  aria-label={`انتقل إلى الصورة ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
