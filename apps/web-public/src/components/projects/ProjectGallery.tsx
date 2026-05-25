'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import type { PublicMedia } from '@/lib/api-types';
import { CoverImage } from '@/components/ui/CoverImage';

interface ProjectGalleryProps {
  media: PublicMedia[];
  alt: string;
  /** Overlay content rendered over the main image (name/city/badge). */
  overlay?: React.ReactNode;
}

const SCRIM = 'linear-gradient(to top, rgba(11,23,38,0.80) 0%, rgba(11,23,38,0.18) 45%, transparent 70%)';

/**
 * Cinematic split gallery: a large main image with a thumbnail rail — a
 * vertical column beside it on desktop, a horizontal filmstrip on mobile.
 * Clicking a thumbnail swaps the main image (no carousel dependency). Falls
 * back to the premium gradient when no media exists (CoverImage handles that).
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
        'grid gap-3 lg:h-[clamp(340px,44vw,520px)]',
        hasThumbs && 'lg:grid-cols-[minmax(0,1fr)_232px]',
      )}
    >
      {/* Main image — capped aspect on small screens, fixed height on desktop */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] shadow-card sm:aspect-[16/9] lg:aspect-auto lg:h-full">
        <CoverImage src={current} alt={alt} className="h-full w-full" />
        <div className="pointer-events-none absolute inset-0" style={{ background: SCRIM }} aria-hidden />
        {overlay && <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">{overlay}</div>}
      </div>

      {/* Thumbnail rail */}
      {hasThumbs && (
        <div className="flex gap-3 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {list.map((m, i) => (
            <button
              key={`${m.url}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`صورة ${i + 1}`}
              aria-current={i === active}
              className={cn(
                'relative h-20 w-28 shrink-0 overflow-hidden rounded-2xl ring-2 transition-all duration-200 lg:h-auto lg:w-full lg:flex-1',
                i === active
                  ? 'ring-gold-400'
                  : 'ring-transparent opacity-70 hover:opacity-100 hover:ring-white/40',
              )}
            >
              <CoverImage src={m.url} alt={`${alt} ${i + 1}`} className="h-full w-full" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
