/**
 * Catalog taxonomy: maps the words users type to the values the catalog actually
 * stores. The seed/live catalog mixes Arabic and English city spellings
 * (الرياض / Riyadh) and encodes apartments by bedroom count (1BR/2BR/3BR), so a
 * single user concept must expand to several concrete filter values. The chat
 * search uses the `…FilterValues` lists with the `cityIn`/`typeIn` filters
 * (one query, no fabrication), and the `…LabelFor*` helpers turn live catalog
 * facets back into clean Arabic chips.
 */

import { normalizeArabic } from './normalize';

interface CityEntry {
  /** Canonical Arabic display label (also stored in slot state). */
  label: string;
  /** Spellings to detect in user text (normalized at load). */
  aliases: string[];
  /** Concrete catalog `project.city` values to query (Arabic + English forms). */
  filters: string[];
}

// Saudi cities first (current catalog domain), then common Egyptian areas.
const CITY_ENTRIES: CityEntry[] = [
  { label: 'الرياض', aliases: ['الرياض', 'الریاض', 'riyadh'], filters: ['الرياض', 'Riyadh'] },
  { label: 'جدة', aliases: ['جدة', 'جده', 'jeddah', 'jedda'], filters: ['جدة', 'جده', 'Jeddah'] },
  { label: 'الدمام', aliases: ['الدمام', 'dammam'], filters: ['الدمام', 'Dammam'] },
  { label: 'مكة المكرمة', aliases: ['مكة المكرمة', 'مكة', 'مكه', 'makkah', 'mecca'], filters: ['مكة المكرمة', 'مكة', 'مكه', 'Makkah', 'Mecca'] },
  { label: 'المدينة المنورة', aliases: ['المدينة المنورة', 'المدينة', 'madinah', 'medina'], filters: ['المدينة المنورة', 'المدينة', 'Madinah', 'Medina'] },
  { label: 'الخبر', aliases: ['الخبر', 'khobar'], filters: ['الخبر', 'Khobar', 'Al Khobar'] },
  { label: 'الطائف', aliases: ['الطائف', 'taif'], filters: ['الطائف', 'Taif'] },
  { label: 'أبها', aliases: ['ابها', 'abha'], filters: ['أبها', 'ابها', 'Abha'] },
  // Egypt (kept for recognition; no inventory → safe no-result with suggestions)
  { label: 'العاصمة الإدارية', aliases: ['العاصمة الادارية', 'العاصمة الاداريه'], filters: ['العاصمة الإدارية'] },
  { label: 'القاهرة الجديدة', aliases: ['القاهرة الجديدة', 'القاهره الجديده'], filters: ['القاهرة الجديدة'] },
  { label: 'الشيخ زايد', aliases: ['الشيخ زايد'], filters: ['الشيخ زايد'] },
  { label: 'الساحل الشمالي', aliases: ['الساحل الشمالي'], filters: ['الساحل الشمالي'] },
  { label: '6 أكتوبر', aliases: ['6 اكتوبر', 'السادس من اكتوبر'], filters: ['6 أكتوبر'] },
  { label: 'التجمع', aliases: ['التجمع'], filters: ['التجمع'] },
  { label: 'المعادي', aliases: ['المعادي'], filters: ['المعادي'] },
  { label: 'القاهرة', aliases: ['القاهرة', 'القاهره'], filters: ['القاهرة'] },
  { label: 'الجيزة', aliases: ['الجيزة', 'الجيزه'], filters: ['الجيزة'] },
  { label: 'الإسكندرية', aliases: ['الاسكندرية', 'الاسكندريه'], filters: ['الإسكندرية'] },
];

/** (entry, normalizedAlias) pairs, longest alias first so specific names win. */
const CITY_MATCHERS = CITY_ENTRIES.flatMap((e) =>
  e.aliases.map((a) => ({ entry: e, norm: normalizeArabic(a) })),
).sort((a, b) => b.norm.length - a.norm.length);

/** Find a known city in normalized user text; returns the display label. */
export function matchCityLabel(norm: string): string | undefined {
  return CITY_MATCHERS.find((m) => norm.includes(m.norm))?.entry.label;
}

/** Catalog `project.city` values to query for a stored city label. */
export function cityFilterValues(label: string): string[] {
  return CITY_ENTRIES.find((e) => e.label === label)?.filters ?? [label];
}

/** Turn a raw catalog city string into its clean Arabic display label. */
export function cityLabelForCatalog(raw: string): string {
  const lc = raw.trim().toLowerCase();
  const hit = CITY_ENTRIES.find((e) => e.filters.some((f) => f.toLowerCase() === lc));
  return hit?.label ?? raw;
}

/** Canonical property-type key → concrete catalog `unit.type` values. */
const TYPE_FILTERS: Record<string, string[]> = {
  apartment: ['Apartment', 'apartment', 'Flat', 'flat', '1BR', '2BR', '3BR', '4BR', '5BR'],
  studio: ['Studio', 'studio'],
  villa: ['Villa', 'villa'],
  duplex: ['Duplex', 'duplex'],
  penthouse: ['Penthouse', 'penthouse'],
  townhouse: ['Townhouse', 'townhouse', 'Town House'],
  twinhouse: ['Twinhouse', 'twinhouse', 'Twin House'],
  office: ['Office', 'office'],
  commercial: ['Retail', 'retail', 'Commercial', 'commercial', 'Shop', 'shop'],
  chalet: ['Chalet', 'chalet'],
  land: ['Land', 'land'],
};

export function typeFilterValues(key: string): string[] {
  return TYPE_FILTERS[key] ?? [key];
}

/** Canonical key for a raw catalog `unit.type` (case-insensitive). */
export function typeKeyForCatalog(raw: string): string | undefined {
  const lc = raw.trim().toLowerCase();
  return Object.keys(TYPE_FILTERS).find((key) => TYPE_FILTERS[key]!.some((v) => v.toLowerCase() === lc));
}
