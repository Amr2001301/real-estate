'use client';

import { useCallback, useMemo } from 'react';
import {
  GoogleMap,
  Marker,
  useJsApiLoader,
} from '@react-google-maps/api';
import { AlertTriangle, ExternalLink, Loader2, MapPin } from 'lucide-react';
import { cn } from '@/lib/cn';

const DEFAULT_CENTER = { lat: 30.0444, lng: 31.2357 };
const DEFAULT_ZOOM_EMPTY = 6;
const DEFAULT_ZOOM_MARKER = 14;

const HEIGHT_CLASS = {
  sm: 'h-44',
  md: 'h-64',
  lg: 'h-80',
} as const;

type Height = keyof typeof HEIGHT_CLASS;

interface BaseProps {
  height?: Height;
  className?: string;
  city?: string | null;
}

interface DisplayProps extends BaseProps {
  mode?: 'display';
  lat: number | null | undefined;
  lng: number | null | undefined;
  onChange?: never;
}

interface EditableProps extends BaseProps {
  mode: 'editable';
  lat: number | null | undefined;
  lng: number | null | undefined;
  onChange: (lat: number, lng: number) => void;
}

type Props = DisplayProps | EditableProps;

type MapMouseEvtLike = {
  latLng?: { lat: () => number; lng: () => number } | null;
};

function isValidCoord(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export function ProjectMap(props: Props) {
  const { mode = 'display', lat, lng, height = 'md', className, city } = props;
  const hasCoords = isValidCoord(lat, lng);

  // Display mode uses an iframe embed — no API key required.
  if (mode === 'display') {
    return (
      <IframeMap
        lat={hasCoords ? (lat as number) : null}
        lng={hasCoords ? (lng as number) : null}
        height={height}
        className={className}
        city={city}
      />
    );
  }

  // Editable mode (project edit form) uses the Google Maps JS API.
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  const hasKey = apiKey.length > 0;

  if (!hasKey) {
    return (
      <MapFallback
        height={height}
        className={className}
        city={city}
        lat={hasCoords ? (lat as number) : null}
        lng={hasCoords ? (lng as number) : null}
        reason="missing-key"
      />
    );
  }

  return (
    <LoadedMap
      mode="editable"
      lat={lat ?? null}
      lng={lng ?? null}
      height={height}
      className={className}
      city={city}
      apiKey={apiKey}
      onChange={props.onChange}
    />
  );
}

// ── Iframe display map (no API key) ──────────────────────────────────────────

function IframeMap({
  lat,
  lng,
  height,
  className,
  city,
}: {
  lat: number | null;
  lng: number | null;
  height: Height;
  className?: string;
  city?: string | null;
}) {
  const hasCoords = lat !== null && lng !== null;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-inset ring-hairline',
        HEIGHT_CLASS[height],
        className,
      )}
    >
      {hasCoords ? (
        <>
          <iframe
            src={`https://maps.google.com/maps?q=${lat},${lng}&z=14&output=embed`}
            className="absolute inset-0 h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="موقع المشروع على الخريطة"
          />
          {city && (
            <div className="pointer-events-none absolute end-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-2xs font-semibold text-slate-700 shadow-sm backdrop-blur">
              <MapPin className="h-3 w-3 text-brand-600" />
              {city}
            </div>
          )}
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-3 start-3 z-10 inline-flex items-center gap-1.5 rounded-xl bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm backdrop-blur transition-colors hover:bg-white"
          >
            افتح في خرائط جوجل
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
          <MapPin className="h-6 w-6" strokeWidth={1.5} />
          <p className="text-xs">لم يُحدد موقع للمشروع</p>
        </div>
      )}
    </div>
  );
}

// ── Editable map (Google Maps JS API) ────────────────────────────────────────

interface LoadedMapProps {
  mode: 'editable';
  lat: number | null;
  lng: number | null;
  height: Height;
  className?: string;
  city?: string | null;
  apiKey: string;
  onChange?: (lat: number, lng: number) => void;
}

function LoadedMap({
  lat,
  lng,
  height,
  className,
  city,
  apiKey,
  onChange,
}: LoadedMapProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
  });

  const hasCoords = isValidCoord(lat, lng);
  const center = useMemo(
    () => (hasCoords ? { lat: lat!, lng: lng! } : DEFAULT_CENTER),
    [hasCoords, lat, lng],
  );
  const zoom = hasCoords ? DEFAULT_ZOOM_MARKER : DEFAULT_ZOOM_EMPTY;

  const handleMapClick = useCallback(
    (e: MapMouseEvtLike) => {
      if (!onChange) return;
      const nextLat = e.latLng?.lat();
      const nextLng = e.latLng?.lng();
      if (typeof nextLat === 'number' && typeof nextLng === 'number') {
        onChange(nextLat, nextLng);
      }
    },
    [onChange],
  );

  const handleMarkerDragEnd = useCallback(
    (e: MapMouseEvtLike) => {
      if (!onChange) return;
      const nextLat = e.latLng?.lat();
      const nextLng = e.latLng?.lng();
      if (typeof nextLat === 'number' && typeof nextLng === 'number') {
        onChange(nextLat, nextLng);
      }
    },
    [onChange],
  );

  if (loadError) {
    return (
      <MapFallback
        height={height}
        className={className}
        city={city}
        lat={hasCoords ? lat : null}
        lng={hasCoords ? lng : null}
        reason="load-error"
      />
    );
  }

  if (!isLoaded) {
    return (
      <MapShell height={height} className={className}>
        <div className="absolute inset-0 flex items-center justify-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="ms-2 text-xs">جارٍ تحميل الخريطة…</span>
        </div>
      </MapShell>
    );
  }

  return (
    <MapShell height={height} className={className}>
      <GoogleMap
        center={center}
        zoom={zoom}
        mapContainerStyle={{ width: '100%', height: '100%' }}
        onClick={handleMapClick}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        }}
      >
        {hasCoords && (
          <Marker
            position={{ lat: lat!, lng: lng! }}
            draggable
            onDragEnd={handleMarkerDragEnd}
          />
        )}
      </GoogleMap>

      {city && (
        <div className="pointer-events-none absolute end-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-2xs font-semibold text-slate-700 shadow-sm backdrop-blur">
          <MapPin className="h-3 w-3 text-brand-600" />
          {city}
        </div>
      )}

      <div className="pointer-events-none absolute bottom-3 start-3 inline-flex items-center gap-1.5 rounded-xl bg-white/90 px-2.5 py-1.5 text-2xs font-medium text-slate-700 shadow-sm backdrop-blur">
        <MapPin className="h-3 w-3 text-brand-600" />
        {hasCoords
          ? 'انقر أو اسحب العلامة لتعديل الموقع'
          : 'انقر على الخريطة لتحديد الموقع'}
      </div>
    </MapShell>
  );
}

function MapShell({
  height,
  className,
  children,
}: {
  height: Height;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl bg-surface-muted ring-1 ring-inset ring-hairline',
        HEIGHT_CLASS[height],
        className,
      )}
    >
      {children}
    </div>
  );
}

function MapFallback({
  height,
  className,
  city,
  lat,
  lng,
  reason,
}: {
  height: Height;
  className?: string;
  city?: string | null;
  lat: number | null;
  lng: number | null;
  reason: 'missing-key' | 'load-error';
}) {
  const hasCoords = isValidCoord(lat, lng);
  return (
    <MapShell height={height} className={className}>
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

      <div className="absolute bottom-3 start-3 end-3 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-start gap-1.5 rounded-xl bg-white/90 backdrop-blur text-2xs font-medium text-slate-700 px-2.5 py-1.5 shadow-sm max-w-full">
          <AlertTriangle className="h-3.5 w-3.5 text-warning-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-semibold">
              {reason === 'missing-key'
                ? 'الخريطة التفاعلية غير متوفرة'
                : 'تعذّر تحميل الخريطة'}
            </p>
            <p className="text-slate-500">
              {reason === 'missing-key'
                ? 'أضف NEXT_PUBLIC_GOOGLE_MAPS_API_KEY للتفعيل.'
                : 'تحقق من الاتصال أو من صلاحية المفتاح.'}
            </p>
            {hasCoords && (
              <p className="mt-1 text-slate-600 font-mono" dir="ltr">
                {(lat as number).toFixed(5)}, {(lng as number).toFixed(5)}
              </p>
            )}
          </div>
        </div>

        {hasCoords && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white/90 backdrop-blur text-xs font-semibold text-slate-800 px-3 py-1.5 shadow-sm hover:bg-white transition-colors"
          >
            افتح في خرائط جوجل
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {city && (
        <div className="absolute top-3 end-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 backdrop-blur text-2xs font-semibold text-slate-700 px-2.5 py-1 shadow-sm">
          <MapPin className="h-3 w-3 text-brand-600" />
          {city}
        </div>
      )}
    </MapShell>
  );
}
