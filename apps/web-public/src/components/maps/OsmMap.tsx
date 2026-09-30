'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

// DivIcon avoids the broken-image bug that hits the default Leaflet marker
// when webpack processes the icon PNG URL at build time.
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

export interface OsmMapProps {
  lat: number;
  lng: number;
  /** CSS height value, e.g. '340px' or '100%' */
  height?: string | number;
  className?: string;
}

export function OsmMap({ lat, lng, height = '340px', className }: OsmMapProps) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={15}
      scrollWheelZoom={false}
      style={{ height, width: '100%' }}
      className={className}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution={OSM_ATTRIBUTION}
        maxZoom={19}
      />
      <Marker position={[lat, lng]} icon={GOLD_PIN} />
    </MapContainer>
  );
}
