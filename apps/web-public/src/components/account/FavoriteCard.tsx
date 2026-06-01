import type { Route } from 'next';
import Link from 'next/link';
import { Building2, Home, MapPin, BedDouble, Trash2, ArrowLeft } from 'lucide-react';
import { routes } from '@/lib/routes';
import { formatPrice, formatNumber, pickAr, cityLabel, unitTypeLabel } from '@/lib/format';
import type { FavoriteItem } from '@/lib/api-types';
import { AccountCard } from '@/components/account/AccountCard';
import { CoverImage } from '@/components/ui/CoverImage';
import { removeFavoriteAction } from '@/lib/account-actions';

interface View {
  href: Route;
  thumb: string | null;
  badge: string;
  BadgeIcon: typeof Building2;
  title: string;
  meta: string;
  price: string | null;
}

/** Normalise a favorite (project OR unit) into one render shape. */
function toView(fav: FavoriteItem): View | null {
  if (fav.unit) {
    const u = fav.unit;
    return {
      href: routes.unit(u.id) as Route,
      thumb: u.media[0]?.url ?? null,
      badge: 'وحدة',
      BadgeIcon: Home,
      title: `${unitTypeLabel(u.type)} · ${u.code}`,
      meta: [u.bedrooms > 0 ? `${formatNumber(u.bedrooms)} غرف` : '', u.area > 0 ? `${formatNumber(u.area)} م²` : '']
        .filter(Boolean)
        .join(' · '),
      price: u.price,
    };
  }
  if (fav.project) {
    const p = fav.project;
    return {
      href: routes.project(p.id) as Route,
      thumb: p.media[0]?.url ?? null,
      badge: 'مشروع',
      BadgeIcon: Building2,
      title: pickAr(p.name) || 'مشروع',
      meta: cityLabel(p.city),
      price: null,
    };
  }
  return null;
}

export function FavoriteCard({ favorite }: { favorite: FavoriteItem }) {
  const v = toView(favorite);
  if (!v) return null;
  const { BadgeIcon } = v;

  return (
    <AccountCard accent="gold">
      <div className="flex items-stretch">
      {/* Clickable area → public detail page */}
      <Link href={v.href} className="group flex min-w-0 flex-1 items-center gap-4 p-3">
        <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-xl">
          <CoverImage src={v.thumb} alt={v.title} className="h-full w-full" zoomOnHover />
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-navy/55 px-2 py-0.5 text-[11px] font-medium text-white ring-1 ring-white/15 backdrop-blur-md">
            <BadgeIcon className="h-3 w-3 shrink-0 text-gold-300" aria-hidden />
            {v.badge}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-1 text-base font-semibold text-ink-strong">{v.title}</h3>
          {v.meta && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
              {favorite.project ? (
                <MapPin className="h-3.5 w-3.5 shrink-0 text-gold-500" aria-hidden />
              ) : (
                <BedDouble className="h-3.5 w-3.5 shrink-0 text-gold-500" aria-hidden />
              )}
              <span className="line-clamp-1">{v.meta}</span>
            </p>
          )}
          {v.price && <div className="mt-2 font-display text-lg font-bold text-ink-strong">{formatPrice(v.price)}</div>}
          <span className="mt-2 inline-flex items-center gap-1 text-xs text-ink-muted transition-colors group-hover:text-gold-600">
            عرض التفاصيل
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          </span>
        </div>
      </Link>

      {/* Remove — sibling of the link (never nested), bound to this favorite's id */}
      <form action={removeFavoriteAction.bind(null, favorite.id)} className="flex items-center border-s border-hairline">
        <button
          type="submit"
          aria-label="إزالة من المفضلة"
          className="flex h-full items-center justify-center px-4 text-ink-muted transition-colors hover:bg-error/5 hover:text-error"
        >
          <Trash2 className="h-5 w-5" aria-hidden />
        </button>
      </form>
      </div>
    </AccountCard>
  );
}
