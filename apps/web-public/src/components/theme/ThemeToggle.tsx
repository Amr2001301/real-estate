'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/cn';

/**
 * Light/dark switch. Reads the *resolved* theme (so a "system" preference shows
 * the right icon) and flips to the opposite. Renders an inert placeholder until
 * mounted to avoid a hydration mismatch, since the active theme is only known
 * on the client.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      aria-label={isDark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={cn(
        'inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors',
        'text-ink-muted hover:bg-ink-muted/10 hover:text-ink-strong',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60',
        className,
      )}
    >
      {mounted ? (
        isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />
      ) : (
        <span className="h-5 w-5" aria-hidden />
      )}
    </button>
  );
}
