'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import type { PublicMedia } from '@/lib/api-types';
import { CoverImage } from '@/components/ui/CoverImage';

interface ProjectGalleryProps {
  media: PublicMedia[];
  alt: string;
  /** Overlay content rendered over the main image (name/city/badge/CTAs). */
  overlay?: React.ReactNode;
}

// Cinematic 4-stop scrim — deepest at the bottom so Arabic text stays readable,
// feathers cleanly into transparency to preserve the image's sky/upper half.
const SCRIM =
  'linear-gradient(to top, rgba(11,23,38,0.93) 0%, rgba(11,23,38,0.60) 28%, rgba(11,23,38,0.16) 52%, transparent 70%)';

/**
 * Premium split gallery: a large cinematic main image with a thumbnail rail
 * — a vertical column on desktop, a horizontal filmstrip on mobile/tablet.
 * Clicking a thumbnail swaps the main image. Falls back to the brand gradient
 * when no media is present (CoverImage handles that).
 */
export function ProjectGallery({ media, alt, overlay }: ProjectGalleryProps) {
  const images = media.filter((m) => m.type === 'IMAGE' || !m.type);
  const list = images.length > 0 ? images : media;
  const [active, setActive] = useState(0);
  const current = list[active]?.url ?? null;
  const hasThumbs = list.length > 1;

  return (
    <div
      className={cn(
        'grid gap-3 lg:h-[clamp(360px,46vw,540px)]',
        hasThumbs && 'lg:grid-cols-[minmax(0,1fr)_228px]',
      )}
    >
      {/* ── Main image ── */}
      <div className="group relative aspect-[4/3] overflow-hidden rounded-[2rem] shadow-[0_20px_56px_-12px_rgba(11,23,38,0.30)] ring-1 ring-black/[0.06] sm:aspect-[16/9] lg:aspect-auto lg:h-full lg:min-h-0">
        <CoverImage src={current} alt={alt} className="h-full w-full" zoomOnHover />

        {/* Cinematic scrim */}
        <div className="pointer-events-none absolute inset-0" style={{ background: SCRIM }} aria-hidden />

        {/* Subtle gold edge glow at the bottom — anchors the overlay visually */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-32 opacity-30"
          style={{
            background:
              'radial-gradient(ellipse 70% 60% at 50% 100%, rgba(200,162,75,0.25) 0%, transparent 70%)',
          }}
          aria-hidden
        />

        {/* Overlay slot */}
        {overlay && (
          <div className="absolute inset-x-0 bottom-0 p-6 sm:p-9">{overlay}</div>
        )}

        {/* Dot-strip image counter — mobile only, top-end corner */}
        {hasThumbs && (
          <div
            className="absolute end-4 top-4 flex items-center gap-1.5 rounded-full bg-navy/55 px-3 py-1.5 backdrop-blur-sm lg:hidden"
            aria-hidden
          >
            {list.map((_, i) => (
              <span
                key={i}
                className={cn(
                  'block h-1.5 rounded-full transition-all duration-300',
                  i === active ? 'w-4 bg-gold-400' : 'w-1.5 bg-white/45',
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Thumbnail rail ──
          Horizontal filmstrip on mobile/tablet, vertical column on desktop.
          lg:min-h-0 lets flex children actually divide the container height. */}
      {hasThumbs && (
        <div className="flex gap-2.5 overflow-x-auto scroll-smooth pb-1 lg:h-full lg:min-h-0 lg:flex-col lg:overflow-visible lg:pb-0">
          {list.map((m, i) => (
            <button
              key={`${m.url}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`عرض الصورة ${i + 1}`}
              aria-current={i === active}
              className={cn(
                'group/thumb relative h-20 w-28 shrink-0 overflow-hidden rounded-2xl transition-all duration-300 ease-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/70 focus-visible:ring-offset-2 lg:h-auto lg:w-full lg:min-h-0 lg:flex-1',
                i === active
                  ? 'opacity-100 ring-2 ring-gold-400 shadow-[0_0_0_4px_rgba(200,162,75,0.18),0_4px_20px_-4px_rgba(11,23,38,0.25)]'
                  : 'opacity-55 ring-1 ring-transparent hover:opacity-92 hover:ring-white/20',
              )}
            >
              <CoverImage src={m.url} alt={`${alt} — صورة ${i + 1}`} className="h-full w-full" />

              {/* Dark veil on inactive thumbnails that fades on hover */}
              {i !== active && (
                <div
                  className="pointer-events-none absolute inset-0 bg-navy/25 transition-opacity duration-300 group-hover/thumb:opacity-0"
                  aria-hidden
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
