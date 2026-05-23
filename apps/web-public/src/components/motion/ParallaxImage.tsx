'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

interface ParallaxImageProps {
  src: string;
  alt: string;
  /** Travel intensity (0–0.2 recommended). Higher = more movement. */
  intensity?: number;
  className?: string;
  imgClassName?: string;
  /** Slow Ken-Burns zoom on top of the parallax. */
  kenBurns?: boolean;
}

/**
 * Subtle scroll parallax using transform only (GPU-friendly). Disabled when the
 * user prefers reduced motion, on touch/coarse pointers, and when off-screen.
 */
export function ParallaxImage({
  src,
  alt,
  intensity = 0.08,
  className,
  imgClassName,
  kenBurns = false,
}: ParallaxImageProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    if (reduce || coarse) return;

    let raf = 0;
    const update = () => {
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      const progress = (rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight;
      setOffset(-progress * intensity * rect.height);
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [intensity]);

  return (
    <div ref={wrapRef} className={cn('relative overflow-hidden', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        decoding="async"
        style={{ transform: `translate3d(0, ${offset}px, 0) scale(${1 + intensity})` }}
        className={cn(
          'h-full w-full object-cover',
          kenBurns && 'motion-safe:animate-ken-burns',
          imgClassName,
        )}
      />
    </div>
  );
}
