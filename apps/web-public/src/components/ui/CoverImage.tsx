'use client';

import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useSiteLocale } from '@/components/locale/SiteLocaleProvider';
import { siteT } from '@/messages/site';

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
  const noPhotos = siteT(useSiteLocale()).listing.noPhotos;

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
          className="flex h-full w-full flex-col items-center justify-center gap-2.5 text-ink-muted"
          role="img"
          aria-label={alt}
          style={{
            // Soft diagonal stripes: reads as "photo to come", not as an empty block.
            background:
              'repeating-linear-gradient(135deg, rgb(var(--c-surface-soft)) 0 14px, rgb(var(--c-canvas)) 14px 28px)',
          }}
        >
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-hairline bg-surface text-navy dark:text-gold-300">
            <Building2 className="h-7 w-7" strokeWidth={1.5} aria-hidden />
          </span>
          <span className="text-[13px] font-medium">{noPhotos}</span>
        </div>
      )}
    </div>
  );
}
