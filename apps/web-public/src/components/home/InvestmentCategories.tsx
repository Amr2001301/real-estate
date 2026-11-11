import Link from 'next/link';
import type { Route } from 'next';
import { ChevronLeft } from 'lucide-react';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { Container } from '@/components/ui/Container';
import type { Locale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { SectionHead } from './SectionHead';

/** One photo per field (public/images/home). */
const IMAGES: Record<string, string> = {
  RESIDENTIAL: 'residential',
  ADMINISTRATIVE: 'administrative',
  COMMERCIAL: 'commercial',
  MEDICAL: 'medical',
};

/**
 * «اختر مجال استثمارك» as photo tiles: the first large on its own, the rest
 * in a grid beside it. A tile opens the projects that still have an available
 * unit of that kind, and shows how many units it holds. A field the company
 * has no available unit in is left out (it could only lead to an empty
 * page), and with fewer than two fields left there is nothing to choose
 * between, so the section is not shown.
 */
export function InvestmentCategories({
  locale,
  counts = {},
}: {
  locale: Locale;
  /** Available units per usage (RESIDENTIAL, …); null when the count failed. */
  counts?: Partial<Record<string, number | null>>;
}) {
  const m = siteT(locale).home.categories;

  const tiles = m.items
    .filter((item) => counts[item.usage] !== 0)
    .map((item) => {
      const n = counts[item.usage];
      return {
        ...item,
        image: `/images/home/${IMAGES[item.usage] ?? 'residential'}.jpg`,
        href: `${routes.projects}?usage=${item.usage}` as Route,
        count: n != null && n > 0 ? m.count(formatNumber(n, locale)) : null,
      };
    });
  if (tiles.length < 2) return null;
  const [first, ...rest] = tiles;

  return (
    <section className="pt-20 sm:pt-24">
      <Container>
        <SectionHead eyebrow={m.eyebrow} title={m.title} sub={m.sub} />
        <div className="flex flex-col gap-5 lg:flex-row">
          {first && <Tile tile={first} big />}
          <div
            className={cn('grid flex-[1.3] grid-cols-1 gap-5', rest.length > 1 && 'sm:grid-cols-2')}
          >
            {rest.map((t, i) => (
              <Tile
                key={t.title}
                tile={t}
                wide={rest.length > 1 && rest.length % 2 === 1 && i === rest.length - 1}
              />
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

function Tile({
  tile,
  big = false,
  wide = false,
}: {
  tile: { title: string; sub: string; image: string; href: Route; count: string | null };
  big?: boolean;
  /** The odd one out at the end of the grid spans both columns. */
  wide?: boolean;
}) {
  return (
    <Link
      href={tile.href}
      className={cn(
        'group relative isolate block overflow-hidden rounded-3xl bg-surface-soft text-white outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        big ? 'min-h-[320px] flex-1 lg:min-h-[520px]' : 'min-h-[220px] lg:min-h-[250px]',
        wide && 'sm:col-span-2',
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={tile.image}
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 -z-10 h-full w-full object-cover transition-transform duration-700 ease-smooth group-hover:scale-[1.05]"
      />
      <span
        className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/35 to-transparent"
        aria-hidden
      />
      <span
        className="absolute end-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/35 bg-white/15 backdrop-blur transition-colors group-hover:bg-white/30"
        aria-hidden
      >
        <ChevronLeft className="h-5 w-5 ltr:rotate-180" />
      </span>
      <div className="absolute inset-x-5 bottom-5 flex items-end justify-between gap-3">
        <div>
          <h3
            className={cn(
              'font-display font-semibold leading-tight text-white',
              big ? 'text-[2rem]' : 'text-2xl',
            )}
          >
            {tile.title}
          </h3>
          <p className="mt-1 text-sm text-white/85 sm:text-[15px]">{tile.sub}</p>
        </div>
        {tile.count && (
          <span className="shrink-0 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-[#1A1F1C]">
            {tile.count}
          </span>
        )}
      </div>
    </Link>
  );
}
