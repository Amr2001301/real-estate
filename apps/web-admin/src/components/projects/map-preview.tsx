import { ExternalLink, MapPin } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Props {
  lat: number;
  lng: number;
  city?: string;
  className?: string;
  /** Render the action button as a link out to Google Maps. */
  showOpenButton?: boolean;
  height?: 'sm' | 'md' | 'lg';
}

const HEIGHT = {
  sm: 'h-32',
  md: 'h-44',
  lg: 'h-56',
};

export function MapPreview({
  lat,
  lng,
  city,
  className,
  showOpenButton = true,
  height = 'md',
}: Props) {
  const href = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl ring-1 ring-inset ring-hairline',
        HEIGHT[height],
        className,
      )}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundColor: '#E7EFE2',
          backgroundImage:
            'linear-gradient(120deg, rgba(201,154,46,0.10) 0%, transparent 40%, rgba(30,51,72,0.05) 80%), repeating-linear-gradient(45deg, rgba(15,23,42,0.04) 0 1px, transparent 1px 22px), repeating-linear-gradient(135deg, rgba(15,23,42,0.04) 0 1px, transparent 1px 22px)',
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative">
          <span className="absolute inset-0 -m-3 rounded-full bg-brand-500/20 animate-pulse" />
          <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-white shadow-md">
            <MapPin className="h-5 w-5" strokeWidth={2} />
          </span>
        </div>
      </div>

      {showOpenButton && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-3 start-3 inline-flex items-center gap-1.5 rounded-xl bg-white/90 backdrop-blur text-xs font-semibold text-slate-800 px-3 py-1.5 shadow-sm hover:bg-white transition-colors"
        >
          افتح الخريطة
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}

      {city && (
        <div className="absolute top-3 end-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 backdrop-blur text-2xs font-semibold text-slate-700 px-2.5 py-1 shadow-sm">
          <MapPin className="h-3 w-3 text-brand-600" />
          {city}
        </div>
      )}
    </div>
  );
}
