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

/**
 * A saved favorite — shape of GET /v1/me/favorites items. The API includes the
 * raw project/unit row (with its first media), so `name` is Translatable and
 * `price` is a Decimal-as-string. Exactly one of project/unit is non-null.
 */
export interface FavoriteProjectRef {
  id: string;
  name: Translatable;
  city: string | null;
  media: { url: string }[];
}

export interface FavoriteUnitRef {
  id: string;
  code: string;
  type: string;
  area: number;
  bedrooms: number;
  bathrooms: number;
  price: string;
  status: string;
  media: { url: string }[];
}

export interface FavoriteItem {
  id: string;
  projectId: string | null;
  unitId: string | null;
  createdAt: string;
  project: FavoriteProjectRef | null;
  unit: FavoriteUnitRef | null;
}

/** Authenticated user's own profile — shape of GET /v1/users/me. */
export interface MeProfile {
  id: string;
  role: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  locale: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  managerId: string | null;
}
