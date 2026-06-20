'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { IconButton } from '@/components/ui/icon-button';

/**
 * Bell + unread badge for the admin topbar. Seeded with a server-fetched count
 * so the first paint is correct, then kept fresh with a lightweight strategy:
 *   - refetch on window focus / tab becoming visible
 *   - poll every 60s, but ONLY while the tab is visible (no background hammer)
 * Fetches the dedicated GET /v1/me/notifications/unread-count via the
 * authenticated /api-proxy rewrite (middleware injects the bearer). Any failure
 * keeps the last known count — the badge never breaks the topbar.
 */
const POLL_MS = 60_000;

export function NotificationBell({
  href,
  initialCount,
}: {
  href: string;
  initialCount: number;
}) {
  const [count, setCount] = useState(initialCount);

  const refresh = useCallback(async () => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    try {
      const res = await fetch('/api-proxy/me/notifications/unread-count', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = (await res.json()) as { count?: number };
      if (typeof data.count === 'number') setCount(data.count);
    } catch {
      /* keep last known count */
    }
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(refresh, POLL_MS);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, [refresh]);

  return (
    <Link href={href as never} className="relative inline-flex">
      <IconButton label="الإشعارات" variant="ghost" size="md" className="text-slate-400 hover:text-slate-700 hover:bg-surface-muted/80 rounded-xl">
        <Bell />
      </IconButton>
      {count > 0 && (
        <span
          aria-label={`${count} إشعار غير مقروء`}
          className="absolute -top-1 -end-1 min-w-[20px] h-[20px] px-1 inline-flex items-center justify-center rounded-full bg-brand-500 text-white text-[10px] font-bold ring-2 ring-surface tabular-nums shadow-sm"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
