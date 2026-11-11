'use client';

import dynamic from 'next/dynamic';
import { MapPin, ExternalLink } from 'lucide-react';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { ButtonLink } from '@/components/ui/Button';
import { extraT } from '@/messages/site-extra';
import type { Locale } from '@/lib/locale';
import { DetailHead } from '@/components/detail/DetailStats';

// OSM/Leaflet requires window — load client-only.
const OsmMap = dynamic(
  () => import('../maps/OsmMap').then((m) => ({ default: m.OsmMap })),
  { ssr: false, loading: () => <div className="h-[240px] w-full animate-pulse bg-slate-100 sm:h-[300px]" /> },
);

interface ProjectLocationProps {
  city: string;
  lat: number | null;
  lng: number | null;
  locale?: Locale;
}

function hasCoords(lat: number | null, lng: number | null): lat is number {
  return typeof lat === 'number' && typeof lng === 'number' && (lat !== 0 || lng !== 0);
}

export function ProjectLocation({ city, lat, lng, locale = 'ar' }: ProjectLocationProps) {
  const t = extraT(locale).projectLocation;
  const coords = hasCoords(lat, lng);
  const mapsUrl = coords ? `https://www.google.com/maps?q=${lat},${lng}` : null;

  return (
    <div>
      <DetailHead eyebrow={t.eyebrow} title={t.title} />

      <PremiumCard className="overflow-hidden">
        {coords ? (
          <OsmMap lat={lat!} lng={lng!} height="240px" className="sm:!h-[300px]" />
        ) : (
          <div
            className="relative flex min-h-56 items-center justify-center"
            style={{ background: 'linear-gradient(135deg, rgb(var(--c-navy-700)) 0%, rgb(var(--c-navy)) 60%, rgb(var(--c-navy-600)) 100%)' }}
          >
            <span className="pointer-events-none absolute -left-10 top-1/3 h-40 w-40 rounded-full bg-gold-400/15 blur-2xl" aria-hidden />
            <div className="relative flex flex-col items-center text-center text-white">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                <MapPin className="h-7 w-7 text-gold-200" aria-hidden />
              </span>
              <p className="mt-3 text-white/85">{city || t.onRequest}</p>
              <p className="mt-1 text-xs text-white/55">{t.soon}</p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <span className="inline-flex items-center gap-2 text-sm text-ink-muted">
            <MapPin className="h-4 w-4 shrink-0 text-gold-500" aria-hidden />
            {city || t.onRequest}
            {coords && (
              <span dir="ltr" className="text-xs text-ink-muted/70">
                ({lat!.toFixed(5)}, {lng!.toFixed(5)})
              </span>
            )}
          </span>
          {mapsUrl && (
            <ButtonLink href={mapsUrl} variant="outline" size="sm">
              {t.openMaps}
              <ExternalLink className="h-4 w-4" aria-hidden />
            </ButtonLink>
          )}
        </div>
      </PremiumCard>
    </div>
  );
}
