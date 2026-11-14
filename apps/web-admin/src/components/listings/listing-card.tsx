import Link from 'next/link';
import { BedDouble, Bath, Building2, MapPin, Maximize2 } from 'lucide-react';
import type { Locale } from '@/lib/locale';
import { compactParts } from '@/lib/format';
import { cn } from '@/lib/cn';
import { listingsT, type Listing, type ListingKind, type ListingStatus } from './messages';

/** The offer type as a small gold-on-navy tag. */
export function KindTag({ kind, locale, className }: { kind: ListingKind; locale: Locale; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-[#D8B66A]/40 bg-[#0E1626]/85 px-2.5 py-1 text-[11.5px] font-bold text-[#E6C77E] backdrop-blur',
        className,
      )}
    >
      {listingsT(locale).kind[kind]}
    </span>
  );
}

const STATUS_TONE: Record<ListingStatus, string> = {
  AVAILABLE: 'bg-success-50 text-success-700 border-success-100',
  UNDER_OFFER: 'bg-amber-500/10 text-amber-700 border-amber-500/25',
  CLOSED: 'bg-slate-500/10 text-slate-700 border-slate-500/20',
  WITHDRAWN: 'bg-danger-50 text-danger-700 border-danger-100',
};

/** The status, «أُغلقت» read as sold / rented for the listing's kind. */
export function StatusTag({ status, kind, locale, className }: { status: ListingStatus; kind: ListingKind; locale: Locale; className?: string }) {
  const m = listingsT(locale);
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-bold', STATUS_TONE[status], className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {status === 'CLOSED' ? m.closed[kind] : m.status[status]}
    </span>
  );
}

/** A photo-less listing: the navy ground with a fine gold building. */
export function ListingPhotoPlaceholder({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cn('relative grid place-items-center overflow-hidden bg-[radial-gradient(120%_90%_at_80%_0%,#1B2A44_0%,#0E1626_60%)]', className)}>
      <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(#D8B66A_1px,transparent_1px),linear-gradient(90deg,#D8B66A_1px,transparent_1px)] [background-size:28px_28px]" aria-hidden />
      <div className="relative flex flex-col items-center gap-2 text-[#D8B66A]">
        <Building2 className="h-9 w-9 stroke-[1.2]" aria-hidden />
        {label && <span className="text-[11.5px] font-semibold text-[#A9B0BD]">{label}</span>}
      </div>
    </div>
  );
}

/** The price as a figure and its unit (ألف / مليون + currency), rent per month. */
export function ListingPrice({ listing, symbol, locale, size = 'md', onNavy }: { listing: Pick<Listing, 'price' | 'kind'>; symbol: string; locale: Locale; size?: 'md' | 'lg'; onNavy?: boolean }) {
  const [num, unit] = compactParts(Number(listing.price), symbol, locale);
  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5 leading-none">
      <span className={cn('num font-semibold', onNavy ? 'text-[#F4ECD8]' : 'text-slate-900', size === 'lg' ? 'text-[44px]' : 'text-[28px]')}>{num}</span>
      <span className={cn('text-[12.5px] font-bold', onNavy ? 'text-[#D8B66A]' : 'text-brand-700')}>{unit}</span>
      {listing.kind === 'RENT' && <span className={cn('text-[12px]', onNavy ? 'text-[#A9B0BD]' : 'text-slate-500')}>/ {listingsT(locale).list.perMonth}</span>}
    </p>
  );
}

export function placeLine(l: Pick<Listing, 'compound' | 'district' | 'city'>, sep = '، '): string {
  return [l.compound, l.district, l.city].filter(Boolean).join(sep);
}

/** One listing in the grid: cover photo, tags, title, place, specs and price. */
export function ListingCard({ listing, symbol, locale, typeName }: { listing: Listing; symbol: string; locale: Locale; typeName: string }) {
  const m = listingsT(locale);
  const cover = listing.photos[0];
  return (
    <Link
      href={`/dashboard/listings/${listing.id}` as never}
      data-testid="listing-card"
      className="group flex flex-col overflow-hidden rounded-[22px] border border-hairline bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:border-[#D8B66A]/50 hover:shadow-[0_22px_44px_-28px_rgb(10_17_32/0.45)]"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <ListingPhotoPlaceholder label={m.list.noPhoto} className="h-full w-full" />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/45 to-transparent" aria-hidden />
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <KindTag kind={listing.kind} locale={locale} />
          <StatusTag status={listing.status} kind={listing.kind} locale={locale} className="bg-surface/95" />
        </div>
        <span className="num absolute bottom-3 end-3 rounded-md bg-black/35 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-white/90 backdrop-blur" dir="ltr">
          {listing.code}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-brand-700">{typeName}</p>
          <h3 className="mt-1 line-clamp-2 font-heading text-[17px] font-bold leading-snug text-slate-900">{listing.title}</h3>
          <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-slate-500">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{placeLine(listing)}</span>
          </p>
        </div>

        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-slate-600">
          <li className="flex items-center gap-1.5"><Maximize2 className="h-3.5 w-3.5 text-slate-400" aria-hidden /><span className="font-bold tabular-nums text-slate-800">{listing.area}</span> {m.card.area}</li>
          {listing.bedrooms !== null && listing.bedrooms > 0 && (
            <li className="flex items-center gap-1.5"><BedDouble className="h-3.5 w-3.5 text-slate-400" aria-hidden /><span className="font-bold tabular-nums text-slate-800">{listing.bedrooms}</span> {m.card.beds}</li>
          )}
          {listing.bathrooms !== null && listing.bathrooms > 0 && (
            <li className="flex items-center gap-1.5"><Bath className="h-3.5 w-3.5 text-slate-400" aria-hidden /><span className="font-bold tabular-nums text-slate-800">{listing.bathrooms}</span> {m.card.baths}</li>
          )}
        </ul>

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-hairline pt-4">
          <ListingPrice listing={listing} symbol={symbol} locale={locale} />
          {listing.agent && <span className="max-w-[45%] truncate text-[12px] text-slate-500">{listing.agent.fullName}</span>}
        </div>
      </div>
    </Link>
  );
}
