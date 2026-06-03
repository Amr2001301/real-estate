'use client';

import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { cn } from '@/lib/cn';

interface CoverImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  imgClassName?: string;
  /** Adds a slow zoom-on-hover when the parent group is hovered. */
  zoomOnHover?: boolean;
}

/**
 * Cover image with a premium gradient fallback — never a broken-image icon. The
 * fallback covers BOTH a missing/empty `src` AND a runtime load failure (e.g. a
 * stale/invalid R2 URL): `onError` records the failed URL and swaps to the
 * placeholder. Keying the failure to the URL itself means a new `src` recovers
 * automatically, and the placeholder (which renders no <img>) can never loop.
 * Uses <img> (R2 URLs aren't in next/image remotePatterns yet). The single
 * eslint-disable is centralized here.
 */
export function CoverImage({ src, alt, className, imgClassName, zoomOnHover }: CoverImageProps) {
  // Normalize: null/undefined/empty/whitespace-only → "no image".
  const normalized = typeof src === 'string' && src.trim() !== '' ? src.trim() : null;
  const [erroredSrc, setErroredSrc] = useState<string | null>(null);
  const showImage = normalized !== null && erroredSrc !== normalized;

  return (
    <div className={cn('relative overflow-hidden bg-surface-soft', className)}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={normalized}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setErroredSrc(normalized)}
          className={cn(
            'h-full w-full object-cover',
            zoomOnHover && 'transition-transform duration-700 ease-smooth group-hover:scale-[1.05]',
            imgClassName,
          )}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center"
          role="img"
          aria-label={alt}
          style={{
            background:
              'linear-gradient(135deg, #26405F 0%, #1C3050 55%, #0F1E33 100%)',
          }}
        >
          <span className="pointer-events-none absolute -left-10 top-1/3 h-40 w-40 rounded-full bg-gold-400/20 blur-2xl" />
          {/* A clear building watermark so a media-less card reads as an
              intentional placeholder rather than an empty void — matters most
              on the dark theme, where the gradient alone blends into the page. */}
          <Building2 className="h-12 w-12 text-white/25" strokeWidth={1.5} aria-hidden />
        </div>
      )}
    </div>
  );
}
