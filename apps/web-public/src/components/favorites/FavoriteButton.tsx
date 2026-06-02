'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useFavorites } from './FavoritesProvider';

type Kind = 'project' | 'unit';

/** Guests are sent here to sign in, then land in their favorites. */
const LOGIN_HREF = '/login?from=/account/favorites' as Route;

/**
 * Favorite toggle. `overlay` = circular glass button for image corners on
 * cards; `inline` = a full-width pill that matches the detail inquiry actions.
 * Guests get a login CTA (no API call); CLIENT/CUSTOMER toggle via the provider.
 */
export function FavoriteButton({
  kind,
  id,
  variant = 'overlay',
  className,
}: {
  kind: Kind;
  id: string;
  variant?: 'overlay' | 'inline';
  className?: string;
}) {
  const router = useRouter();
  const { canFavorite, isFavorite, isPending, toggle } = useFavorites();
  const active = isFavorite(kind, id);
  const pending = isPending(kind, id);

  const ariaLabel = !canFavorite
    ? 'سجّل الدخول لحفظ المفضلة'
    : active
      ? 'إزالة من المفضلة'
      : 'إضافة إلى المفضلة';

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!canFavorite) {
      router.push(LOGIN_HREF);
      return;
    }
    void toggle(kind, id);
  }

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={canFavorite ? active : undefined}
        aria-label={ariaLabel}
        disabled={pending}
        className={cn(
          'inline-flex w-full items-center justify-center gap-2 rounded-full border px-6 text-[15px] font-medium transition-colors duration-200 disabled:opacity-60 h-12',
          active
            ? 'border-gold-300 bg-gold-100 text-gold-600'
            : 'border-hairline/20 bg-transparent text-ink-strong hover:border-hairline/40 hover:bg-navy/[0.03]',
          className,
        )}
      >
        <Heart className={cn('h-5 w-5', active && 'fill-gold-500 text-gold-500')} aria-hidden />
        {!canFavorite ? 'سجّل الدخول للحفظ' : active ? 'محفوظ في المفضلة' : 'حفظ في المفضلة'}
      </button>
    );
  }

  // overlay
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={canFavorite ? active : undefined}
      aria-label={ariaLabel}
      disabled={pending}
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/80 text-ink-strong shadow-sm ring-1 ring-black/5 backdrop-blur-sm transition-all duration-200 hover:bg-white hover:text-rose-600 disabled:opacity-70',
        active && 'text-gold-500',
        className,
      )}
    >
      <Heart className={cn('h-4 w-4', active && 'fill-gold-500 text-gold-500')} aria-hidden />
    </button>
  );
}
