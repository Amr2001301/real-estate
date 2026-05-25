'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

const TZ = 'Asia/Riyadh';
const DAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Office hours: Sun–Thu, 09:00–18:00 Riyadh time. */
function isOpenNow(): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const day = DAY[get('weekday')] ?? 0;
  const hour = parseInt(get('hour'), 10);
  return day <= 4 && hour >= 9 && hour < 18;
}

/**
 * Live "open / closed" pill based on Riyadh office hours. Renders nothing on
 * the server pass to avoid a hydration mismatch, then fills in on the client
 * and refreshes every minute.
 */
export function OpenStatus({ className }: { className?: string }) {
  const [open, setOpen] = useState<boolean | null>(null);

  useEffect(() => {
    setOpen(isOpenNow());
    const id = setInterval(() => setOpen(isOpenNow()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (open === null) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        open ? 'bg-success/10 text-success' : 'bg-ink-muted/10 text-ink-muted',
        className,
      )}
    >
      <span className="relative flex h-2 w-2">
        {open && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/70" aria-hidden />
        )}
        <span
          className={cn('relative inline-flex h-2 w-2 rounded-full', open ? 'bg-success' : 'bg-ink-muted/50')}
          aria-hidden
        />
      </span>
      {open ? 'مفتوح الآن' : 'مغلق الآن'}
    </span>
  );
}
