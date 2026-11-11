'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A sidebar that stays in view while the page scrolls. When it is taller
 * than the window it first scrolls with the page until its bottom shows, then
 * holds there — so nothing at its foot is ever out of reach (a plain sticky
 * top would hide it).
 */
export function StickyAside({ children, offset = 112 }: { children: React.ReactNode; offset?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(offset);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setTop(Math.min(offset, window.innerHeight - el.offsetHeight - 24));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [offset]);

  return (
    <div ref={ref} className="lg:sticky" style={{ top }}>
      {children}
    </div>
  );
}
