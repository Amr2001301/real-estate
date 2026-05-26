/**
 * Catalog search tool for the rule-based assistant: maps collected slots to the
 * existing public catalog filters and shapes the results into AssistantCards.
 *
 * This file holds the PURE pieces (filter mapping + card shaping + formatting)
 * plus the abstract tool token. The Nest-injectable implementation that calls
 * UnitsService/ProjectsService lives in catalog-search.service.ts, so these
 * mappers stay trivially unit-testable without a DB.
 */

import type { AssistantCard } from '../chat-provider';
import type { Slots } from './slots';
import { PROPERTY_TYPE_LABELS } from './responses';
import { cityFilterValues, typeFilterValues, typeKeyForCatalog } from './catalog-taxonomy';

/** Max cards returned in a single chat turn (top results only). */
export const MAX_CARDS = 5;

export interface CatalogSearchResult {
  cards: AssistantCard[];
  total: number;
}

/** Live catalog facets (Arabic display labels) for context-aware prompts. */
export interface CatalogFacets {
  /** Cities that currently have available units, as clean Arabic labels. */
  cities: string[];
  /** Supported unit-type Arabic labels present in the catalog. */
  types: string[];
}

/** Plain object passed to UnitsService.findAll — mirrors UnitQueryDto fields. */
export interface UnitSearchQuery {
  cityIn?: string[];
  typeIn?: string[];
  bedrooms?: number;
  priceMax?: number;
  areaMin?: number;
  sort?: string;
  page: number;
  pageSize: number;
}

/** Plain object passed to ProjectsService.findAll — mirrors ProjectQueryDto. */
export interface ProjectSearchQuery {
  cityIn?: string[];
  sort?: string;
  page: number;
  pageSize: number;
}

/** Tool contract; injected into the provider and faked in unit tests. */
export abstract class CatalogSearchTool {
  abstract searchUnits(slots: Slots): Promise<CatalogSearchResult>;
  abstract searchProjects(slots: Slots): Promise<CatalogSearchResult>;
  /** Distinct available cities/types for context-aware prompts (cached). */
  abstract getFacets(): Promise<CatalogFacets>;
}

/**
 * Slots → public unit filters. The public listing already enforces
 * AVAILABLE + PUBLISHED, so we only translate the user's criteria. A user city
 * expands to its catalog spelling variants and a user type to its concrete
 * catalog values (e.g. apartment → 1BR/2BR/3BR), matched with `cityIn`/`typeIn`.
 * Default sort is cheapest-first.
 */
export function buildUnitQuery(slots: Slots, limit = MAX_CARDS): UnitSearchQuery {
  const q: UnitSearchQuery = { page: 1, pageSize: limit, sort: 'price_asc' };
  if (slots.city) q.cityIn = cityFilterValues(slots.city);
  if (slots.propertyType) q.typeIn = typeFilterValues(slots.propertyType);
  if (slots.minRooms !== undefined) q.bedrooms = slots.minRooms;
  if (slots.budgetMax !== undefined) q.priceMax = slots.budgetMax;
  if (slots.areaMin !== undefined) q.areaMin = slots.areaMin;
  return q;
}

export function buildProjectQuery(slots: Slots, limit = MAX_CARDS): ProjectSearchQuery {
  const q: ProjectSearchQuery = { page: 1, pageSize: limit, sort: 'newest' };
  if (slots.city) q.cityIn = cityFilterValues(slots.city);
  return q;
}

/** Pick the Arabic string from a Translatable {ar,en} JSON value (or a string). */
export function pickAr(value: unknown, fallback = ''): string {
  if (value && typeof value === 'object' && 'ar' in value) {
    const ar = (value as { ar?: unknown }).ar;
    if (typeof ar === 'string') return ar;
  }
  if (typeof value === 'string') return value;
  return fallback;
}

/** Format a real catalog price (Decimal string/number) for display. Never invents. */
export function formatPrice(value: string | number | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return `${new Intl.NumberFormat('en-US').format(n)} ج.م`;
}

/** The subset of the public unit serializer the card needs. */
export interface PublicUnitLike {
  id: string;
  code?: string | null;
  type?: string | null;
  area?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  price?: string | number | null;
  coverImage?: string | null;
  project?: { id: string; name?: unknown; city?: string | null } | null;
}

export interface PublicProjectLike {
  id: string;
  name?: unknown;
  city?: string | null;
  coverImage?: string | null;
  availableUnitsCount?: number;
}

export function toUnitCard(u: PublicUnitLike): AssistantCard {
  // Resolve the catalog's raw type (e.g. "2BR", "Duplex") to a canonical key so
  // the Arabic label is correct ("شقة"/"دوبلكس") rather than a generic fallback.
  const typeKey = u.type ? typeKeyForCatalog(u.type) : undefined;
  const typeLabel = (typeKey && PROPERTY_TYPE_LABELS[typeKey]) || 'عقار';
  const projectName = u.project ? pickAr(u.project.name) : '';
  return {
    type: 'unit',
    id: u.id,
    title: u.code ? `${typeLabel} • ${u.code}` : typeLabel,
    subtitle: projectName || undefined,
    price: formatPrice(u.price ?? null),
    area: u.area ?? undefined,
    bedrooms: u.bedrooms ?? undefined,
    bathrooms: u.bathrooms ?? undefined,
    city: u.project?.city ?? undefined,
    imageUrl: u.coverImage ?? null,
    href: `/units/${u.id}`,
  };
}

export function toProjectCard(p: PublicProjectLike): AssistantCard {
  const count = p.availableUnitsCount ?? 0;
  return {
    type: 'project',
    id: p.id,
    title: pickAr(p.name, 'مشروع'),
    subtitle: count > 0 ? `${count} وحدة متاحة` : undefined,
    city: p.city ?? undefined,
    imageUrl: p.coverImage ?? null,
    href: `/projects/${p.id}`,
  };
}
