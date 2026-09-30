'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { ExternalLink, MapPin } from 'lucide-react';

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

const GOLD_PIN = L.divIcon({
  html: `
    <div style="display:flex;flex-direction:column;align-items:center">
      <div style="
        width:28px;height:28px;
        background:#C99A2E;
        border-radius:50%;
        border:2.5px solid #fff;
        box-shadow:0 2px 10px rgba(201,154,46,0.55);
        display:flex;align-items:center;justify-content:center;
      ">
        <svg viewBox="0 0 24 24" fill="white" width="14" height="14">
          <path d="M12 3C8.69 3 6 5.69 6 9c0 5.25 6 12 6 12s6-6.75 6-12c0-3.31-2.69-6-6-6zm0 8.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/>
        </svg>
      </div>
      <div style="width:2px;height:7px;background:#C99A2E;border-radius:1px"></div>
    </div>`,
  className: '',
  iconSize: [28, 37],
  iconAnchor: [14, 37],
});

export interface OsmDisplayMapProps {
  lat: number;
  lng: number;
  city?: string | null;
  /** Tailwind height class, e.g. 'h-44' */
  heightClass: string;
  className?: string;
}

export function OsmDisplayMap({
  lat,
  lng,
  city,
  heightClass,
  className,
}: OsmDisplayMapProps) {
  return (
    <div className={`relative overflow-hidden rounded-2xl ring-1 ring-inset ring-hairline ${heightClass} ${className ?? ''}`}>
      <MapContainer
        center={[lat, lng]}
        zoom={14}
        scrollWheelZoom={false}
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution={OSM_ATTRIBUTION}
          maxZoom={19}
        />
        <Marker position={[lat, lng]} icon={GOLD_PIN} />
      </MapContainer>

      {city && (
        <div className="pointer-events-none absolute end-3 top-3 z-[400] inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-2xs font-semibold text-slate-700 shadow-sm backdrop-blur">
          <MapPin className="h-3 w-3 text-brand-600" />
          {city}
        </div>
      )}

      <a
        href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-3 start-3 z-[400] inline-flex items-center gap-1.5 rounded-xl bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm backdrop-blur transition-colors hover:bg-white"
      >
        افتح في خرائط جوجل
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
