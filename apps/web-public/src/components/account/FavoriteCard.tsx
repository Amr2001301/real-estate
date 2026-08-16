import type { Route } from 'next';
import Link from 'next/link';
import { Building2, Home, MapPin, BedDouble, Maximize2, Heart, ArrowLeft, type LucideIcon } from 'lucide-react';
import { routes } from '@/lib/routes';
import { formatPrice, formatNumber, pickAr, cityLabel, unitTypeLabel } from '@/lib/format';
import type { FavoriteItem } from '@/lib/api-types';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { CoverImage } from '@/components/ui/CoverImage';
import { removeFavoriteAction } from '@/lib/account-actions';

interface Spec {
  Icon: LucideIcon;
  text: string;
}

interface View {
  href: Route;
  thumb: string | null;
  badge: string;
  BadgeIcon: LucideIcon;
  title: string;
  specs: Spec[];
  price: string | null;
}

/**
 * Luxury favorite tile: a full-bleed cover image with a glass badge + a heart
 * "remove" control, over a tight content block (title · specs · price). The
 * whole card is a single link to the public detail page; the remove form is a
 * SIBLING of that link (never nested — a button inside an <a> is invalid HTML)
 * positioned over the image. A gold chevron disc telegraphs the navigation.
 */
export async function FavoriteCard({ favorite }: { favorite: FavoriteItem }) {
  const locale = await getLocale();
  const m = siteT(locale).accountPages.favorites;

  /** Normalise a favorite (project OR unit) into one render shape. */
  function toView(fav: FavoriteItem): View | null {
    if (fav.unit) {
      const u = fav.unit;
      const specs: Spec[] = [];
      if (u.bedrooms > 0) specs.push({ Icon: BedDouble, text: `${formatNumber(u.bedrooms)} ${m.rooms}` });
      if (u.area > 0) specs.push({ Icon: Maximize2, text: `${formatNumber(u.area)} ${m.sqm}` });
      return {
        href: routes.unit(u.id) as Route,
        thumb: u.media[0]?.url ?? null,
        badge: m.badgeUnit,
        BadgeIcon: Home,
        title: `${unitTypeLabel(u.type)} · ${u.code}`,
        specs,
        price: u.price,
      };
    }
    if (fav.project) {
      const p = fav.project;
      const city = cityLabel(p.city);
      return {
        href: routes.project(p.id) as Route,
        thumb: p.media[0]?.url ?? null,
        badge: m.badgeProject,
        BadgeIcon: Building2,
        title: pickAr(p.name) || m.badgeProject,
        specs: city ? [{ Icon: MapPin, text: city }] : [],
        price: null,
      };
    }
    return null;
  }

  const v = toView(favorite);
  if (!v) return null;
  const { BadgeIcon } = v;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-sm transition-all duration-300 ease-smooth hover:-translate-y-1.5 hover:shadow-xl">
      <Link href={v.href} className="flex flex-1 flex-col">
        {/* ── Cover ── */}
        <div className="relative">
          <CoverImage src={v.thumb} alt={v.title} className="aspect-[16/10] w-full" zoomOnHover />
          {/* Top scrim so the glass controls stay legible over bright photos */}
          <span
            className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/35 to-transparent"
            aria-hidden
          />
          {/* Glass type badge — start (right in RTL) */}
          <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium text-white ring-1 ring-white/30 backdrop-blur-md">
            <BadgeIcon className="h-3.5 w-3.5 shrink-0 text-gold-300" aria-hidden />
            {v.badge}
          </span>
        </div>

        {/* ── Content ── */}
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="min-w-0">
            <h3 className="line-clamp-1 text-base font-bold text-ink-strong">{v.title}</h3>
            {v.specs.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-muted">
                {v.specs.map(({ Icon, text }) => (
                  <span key={text} className="inline-flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-gold-500" aria-hidden />
                    <span className="line-clamp-1">{text}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Footer: price (start) · chevron disc (end) */}
          <div className="mt-auto flex items-center justify-between gap-3 pt-1">
            {v.price ? (
              <div className="font-display text-lg font-extrabold text-ink-strong">{formatPrice(v.price)}</div>
            ) : (
              <span className="text-sm font-medium text-gold-600">{m.viewProject}</span>
            )}
            <span
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-white transition-all duration-300 ease-smooth group-hover:scale-110 group-hover:bg-gold-400 group-hover:text-navy"
              aria-hidden
            >
              <ArrowLeft className="h-4 w-4" />
            </span>
          </div>
        </div>
      </Link>

      {/* Remove — sibling of the link (never nested), bound to this favorite's id */}
      <form action={removeFavoriteAction.bind(null, favorite.id)} className="absolute left-3 top-3 z-10">
        <button
          type="submit"
          aria-label={m.removeLabel}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/30 backdrop-blur-md transition-all duration-200 hover:bg-error hover:text-white hover:ring-error"
        >
          <Heart className="h-4 w-4 fill-current" aria-hidden />
        </button>
      </form>
    </div>
  );
}
