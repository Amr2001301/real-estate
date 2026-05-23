import { MapPin, ExternalLink } from 'lucide-react';
import { SectionHeading } from '@/components/ui/Section';
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
  // External link only — no Maps SDK/dependency.
  const mapsUrl = coords ? `https://www.google.com/maps?q=${lat},${lng}` : null;

  return (
    <div>
      <SectionHeading eyebrow="الموقع" title="أين يقع المشروع" description={city ? `يقع المشروع في ${city}.` : undefined} />
      <PremiumCard className="mt-8 overflow-hidden">
        <div
          className="relative flex min-h-44 items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #1C3050 0%, #0F1E33 60%, #26405F 100%)' }}
        >
          <span className="pointer-events-none absolute -left-10 top-1/3 h-40 w-40 rounded-full bg-gold-400/15 blur-2xl" aria-hidden />
          <div className="relative flex flex-col items-center text-center text-white">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
              <MapPin className="h-7 w-7 text-gold-200" aria-hidden />
            </span>
            <p className="mt-3 text-white/85">{city || 'الموقع متاح عند التواصل'}</p>
            {coords && (
              <p className="mt-1 text-xs text-white/55" dir="ltr">
                {lat!.toFixed(5)}, {lng!.toFixed(5)}
              </p>
            )}
          </div>
        </div>
        {mapsUrl && (
          <div className="flex items-center justify-between p-5">
            <span className="text-sm text-ink-muted">استعرض الموقع على الخريطة</span>
            <ButtonLink href={mapsUrl} variant="outline" size="sm">
              عرض الموقع
              <ExternalLink className="h-4 w-4" aria-hidden />
            </ButtonLink>
          </div>
        )}
      </PremiumCard>
    </div>
  );
}
