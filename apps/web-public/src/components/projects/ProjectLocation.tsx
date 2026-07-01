import { MapPin, ExternalLink } from 'lucide-react';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { ButtonLink } from '@/components/ui/Button';

interface ProjectLocationProps {
  city: string;
  lat: number | null;
  lng: number | null;
}

function hasCoords(lat: number | null, lng: number | null): lat is number {
  return typeof lat === 'number' && typeof lng === 'number' && (lat !== 0 || lng !== 0);
}

export function ProjectLocation({ city, lat, lng }: ProjectLocationProps) {
  const coords = hasCoords(lat, lng);
  const embedUrl = coords ? `https://maps.google.com/maps?q=${lat},${lng}&z=15&hl=ar&output=embed` : null;
  const mapsUrl = coords ? `https://www.google.com/maps?q=${lat},${lng}` : null;

  return (
    <div>
      {/* Section heading — inline pattern, small label + strong title */}
      <div>
        <div className="mb-3 h-0.5 w-10 rounded-full bg-gold-400" />
        <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-500">
          الموقع
        </span>
        <h2 className="mt-1.5 text-[1.65rem] font-bold leading-tight text-ink-strong sm:text-3xl">
          موقع المشروع
        </h2>
        {city && (
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">يقع المشروع في {city}.</p>
        )}
      </div>

      <PremiumCard className="mt-8 overflow-hidden">
        {embedUrl ? (
          <iframe
            src={embedUrl}
            title={`خريطة موقع المشروع${city ? ` في ${city}` : ''}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="block h-[340px] w-full border-0 sm:h-[440px]"
          />
        ) : (
          <div
            className="relative flex min-h-56 items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #1C3050 0%, #0F1E33 60%, #26405F 100%)' }}
          >
            <span className="pointer-events-none absolute -left-10 top-1/3 h-40 w-40 rounded-full bg-gold-400/15 blur-2xl" aria-hidden />
            <div className="relative flex flex-col items-center text-center text-white">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                <MapPin className="h-7 w-7 text-gold-200" aria-hidden />
              </span>
              <p className="mt-3 text-white/85">{city || 'الموقع متاح عند التواصل'}</p>
              <p className="mt-1 text-xs text-white/55">سيتم تحديد الموقع على الخريطة قريبًا</p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <span className="inline-flex items-center gap-2 text-sm text-ink-muted">
            <MapPin className="h-4 w-4 shrink-0 text-gold-500" aria-hidden />
            {city || 'الموقع متاح عند التواصل'}
            {coords && (
              <span dir="ltr" className="text-xs text-ink-muted/70">
                ({lat!.toFixed(5)}, {lng!.toFixed(5)})
              </span>
            )}
          </span>
          {mapsUrl && (
            <ButtonLink href={mapsUrl} variant="outline" size="sm">
              عرض على خرائط Google
              <ExternalLink className="h-4 w-4" aria-hidden />
            </ButtonLink>
          )}
        </div>
      </PremiumCard>
    </div>
  );
}
