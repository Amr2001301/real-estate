'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { PublicProjectListItem } from '@/lib/api-types';
import { ProjectShowcaseCard } from './ProjectShowcaseCard';

const AUTO_MS = 4500;
const EASE = 'transform 500ms cubic-bezier(0.32, 0.72, 0, 1)';

/**
 * Infinite centered carousel: the active card is centred with the prev/next
 * cards peeking on the sides — and it loops forever with no blank edge.
 *
 * How the loop works: we render THREE copies of the list and always keep the
 * "virtual" index inside the middle copy. Moving past the middle copy animates
 * into a clone (so neighbours always exist → never any gap), then on transition
 * end we jump by ±n back to the equivalent middle-copy slide WITHOUT animation.
 * Because the centred project and its peeking neighbours are identical across
 * copies, that jump is invisible. The track is positioned with a pixel
 * translateX from layout geometry, so it's correct in RTL.
 */
export function ProjectsCarousel({ projects }: { projects: PublicProjectListItem[] }) {
  const n = projects.length;
  const loop = n > 1;
  const copies = loop ? 3 : 1;
  const baseVi = loop ? n : 0; // middle copy start

  const slides = useMemo(() => {
    const out: PublicProjectListItem[] = [];
    for (let c = 0; c < copies; c++) out.push(...projects);
    return out;
  }, [projects, copies]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const slidesRef = useRef<Array<HTMLDivElement | null>>([]);
  const pausedRef = useRef(false);

  const [vi, setVi] = useState(baseVi);
  const [noAnim, setNoAnim] = useState(true); // first paint centres without animating
  const realActive = ((vi % n) + n) % n;

  // Apply the centring transform whenever the index or animate-flag changes.
  useLayoutEffect(() => {
    const track = trackRef.current;
    const wrap = wrapRef.current;
    const slide = slidesRef.current[vi];
    if (!track || !wrap || !slide) return;
    const tx = wrap.clientWidth / 2 - (slide.offsetLeft + slide.clientWidth / 2);
    track.style.transition = noAnim ? 'none' : EASE;
    track.style.transform = `translateX(${tx}px)`;
  }, [vi, noAnim]);

  // After a no-anim frame (initial mount / seamless reset), re-enable animation.
  useEffect(() => {
    if (!noAnim) return;
    const id = requestAnimationFrame(() => setNoAnim(false));
    return () => cancelAnimationFrame(id);
  }, [noAnim]);

  // Re-centre instantly on resize.
  useEffect(() => {
    const onResize = () => {
      const track = trackRef.current;
      const wrap = wrapRef.current;
      const slide = slidesRef.current[vi];
      if (!track || !wrap || !slide) return;
      const tx = wrap.clientWidth / 2 - (slide.offsetLeft + slide.clientWidth / 2);
      track.style.transition = 'none';
      track.style.transform = `translateX(${tx}px)`;
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [vi]);

  // Autoplay.
  useEffect(() => {
    if (typeof window === 'undefined' || !loop) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => {
      if (!pausedRef.current) {
        setNoAnim(false);
        setVi((v) => v + 1);
      }
    }, AUTO_MS);
    return () => clearInterval(id);
  }, [loop]);

  function move(delta: number) {
    setNoAnim(false);
    setVi((v) => v + delta);
  }

  function goToReal(j: number) {
    let d = j - realActive;
    if (d > n / 2) d -= n;
    if (d < -n / 2) d += n;
    move(d);
  }

  // After an animated move into a clone region, snap back into the middle copy.
  function onTransitionEnd() {
    if (!loop) return;
    if (vi >= 2 * n) {
      setNoAnim(true);
      setVi(vi - n);
    } else if (vi < n) {
      setNoAnim(true);
      setVi(vi + n);
    }
  }

  const pause = () => (pausedRef.current = true);
  const resume = () => (pausedRef.current = false);
  const arrowBase =
    'absolute top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/75 text-navy shadow-soft backdrop-blur transition-all hover:bg-white hover:shadow-card';

  return (
    <div className="relative" onMouseEnter={pause} onMouseLeave={resume} onFocusCapture={pause} onBlurCapture={resume}>
      <div ref={wrapRef} className="overflow-hidden">
        <div ref={trackRef} className="relative flex items-stretch gap-5" onTransitionEnd={onTransitionEnd}>
          {slides.map((project, i) => (
            <div
              key={`${project.id}-${i}`}
              ref={(el) => {
                slidesRef.current[i] = el;
              }}
              className="shrink-0 basis-[86%] sm:basis-[64%] lg:basis-[58%]"
            >
              <div
                className={cn(
                  'aspect-[4/3] ease-out lg:aspect-[16/10]',
                  noAnim ? 'transition-none' : 'transition-all duration-500',
                  i === vi ? 'scale-100 opacity-100' : 'scale-[0.94] opacity-70',
                )}
              >
                <ProjectShowcaseCard project={project} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {loop && (
        <>
          {/* Light floating arrows (RTL: previous→right, next→left) */}
          <button type="button" aria-label="السابق" onClick={() => move(-1)} className={cn(arrowBase, 'right-2')}>
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
          <button type="button" aria-label="التالي" onClick={() => move(1)} className={cn(arrowBase, 'left-2')}>
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>

          {/* Dots map to real projects only */}
          <div className="mt-4 flex items-center justify-center gap-2">
            {projects.map((p, j) => (
              <button
                key={p.id}
                type="button"
                aria-label={`الانتقال إلى المشروع ${j + 1}`}
                aria-current={j === realActive}
                onClick={() => goToReal(j)}
                className={cn('h-2 rounded-full transition-all', j === realActive ? 'w-6 bg-gold-400' : 'w-2 bg-hairline hover:bg-navy/30')}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
