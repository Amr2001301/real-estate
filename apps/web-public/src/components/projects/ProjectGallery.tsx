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

/**
 * Cinematic main image + thumbnail strip. No carousel dependency — clicking a
 * thumbnail swaps the main image. Falls back to the premium gradient when no
 * media exists (CoverImage handles that).
 */
export function ProjectGallery({ media, alt, overlay }: ProjectGalleryProps) {
  const images = media.filter((m) => m.type === 'IMAGE' || !m.type);
  const list = images.length > 0 ? images : media;
  const [active, setActive] = useState(0);
  const current = list[active]?.url ?? null;

  return (
    <div>
      <div className="relative overflow-hidden rounded-4xl shadow-card">
        <CoverImage src={current} alt={alt} className="aspect-[16/10] sm:aspect-[16/9]" />
        {/* Readability scrim for the overlaid title. */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(11,23,38,0.78) 0%, rgba(11,23,38,0.15) 45%, transparent 70%)' }}
          aria-hidden
        />
        {overlay && (
          <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">{overlay}</div>
        )}
      </div>

      {list.length > 1 && (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-1 scrollbar-thin">
          {list.map((m, i) => (
            <button
              key={`${m.url}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`صورة ${i + 1}`}
              aria-current={i === active}
              className={cn(
                'relative h-20 w-28 shrink-0 overflow-hidden rounded-2xl border-2 transition-all duration-200',
                i === active ? 'border-gold-400' : 'border-transparent opacity-70 hover:opacity-100',
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
