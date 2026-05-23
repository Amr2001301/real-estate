'use client';

import { cn } from '@/lib/cn';
import { useInView } from './useInView';

interface RevealProps {
  /** Entrance delay in ms — used by Stagger to cascade children. */
  delay?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'article';
  children: React.ReactNode;
}

/**
 * Fade + rise entrance when scrolled into view. The `.motion-reveal` class lets
 * the global reduced-motion rule force the final visible state instantly.
 */
export function Reveal({ delay = 0, className, as = 'div', children }: RevealProps) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const Tag = as;
  return (
    <Tag
      ref={ref as never}
      style={{ transitionDelay: inView ? `${delay}ms` : '0ms' }}
      className={cn(
        'motion-reveal transition-all duration-700 ease-smooth will-change-transform',
        inView ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/** Simple opacity-only fade-in (no translate). */
export function FadeIn({ delay = 0, className, children }: RevealProps) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      style={{ transitionDelay: inView ? `${delay}ms` : '0ms' }}
      className={cn(
        'motion-reveal transition-opacity duration-700 ease-smooth',
        inView ? 'opacity-100' : 'opacity-0',
        className,
      )}
    >
      {children}
    </div>
  );
}
