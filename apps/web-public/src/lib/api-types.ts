/**
 * Shapes returned by the hardened W1 public endpoints. Hand-mirrored from the
 * API serializers (apps/api/.../public-*.serializer.ts) — the public surface is
 * intentionally lean, so these stay small.
 */

export interface Translatable {
  ar?: string;
  en?: string;
}

export interface PublicMedia {
  url: string;
  type: string;
  order: number;
}

export interface PublicProjectListItem {
  id: string;
  name: Translatable;
  description: Translatable;
  city: string;
  lat: number;
  lng: number;
  services: Translatable[];
  featured: boolean;
  status: string;
  coverImage: string | null;
  availableUnitsCount: number;
}

export interface PublicProjectDetail {
  id: string;
  name: Translatable;
  description: Translatable;
  city: string;
  lat: number;
  lng: number;
  services: Translatable[];
  featured: boolean;
  status: string;
  media: PublicMedia[];
  availableUnitsCount: number;
}

export interface PublicProjectSummary {
  id: string;
  name: Translatable;
  city: string;
}

export interface PublicUnit {
  id: string;
  code: string;
  type: string;
  area: number;
  bedrooms: number;
  bathrooms: number;
  floor: number;
  price: string;
  status: string;
  coverImage: string | null;
  media: PublicMedia[];
  project: PublicProjectSummary | null;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}
