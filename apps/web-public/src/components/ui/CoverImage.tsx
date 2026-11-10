'use client';

import { useState } from 'react';
import { BuildingArt } from './BuildingArt';
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
        <BuildingArt label={alt} />
      )}
    </div>
  );
}
