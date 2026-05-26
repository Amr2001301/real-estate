/**
 * Deterministic slot extraction from a normalized Arabic message. Each function
 * pulls one structured value (deal type, property type, city, rooms, budget,
 * area) using keyword dictionaries and small regexes. No fabrication: if a value
 * isn't clearly present we return undefined and the engine asks for it.
 */

import { containsAny } from './normalize';
import { matchCityLabel } from './catalog-taxonomy';

export type DealType = 'sale' | 'rent';

export interface Slots {
  dealType?: DealType;
  /** Canonical property-type key (matches catalog filter values in FreeAI-2). */
  propertyType?: string;
  /** Free-text city/area as the user phrased it (display form, normalized). */
  city?: string;
  minRooms?: number;
  /** Interpreted as an upper bound (max budget) in the catalog currency. */
  budgetMax?: number;
  /** Interpreted as a lower bound (min area) in square metres. */
  areaMin?: number;
}

export type SlotField = keyof Slots;

const RENT_WORDS = ['ايجار', 'للايجار', 'ايجارات', 'استئجار', 'rent'] as const;
const SALE_WORDS = ['تمليك', 'شراء', 'للبيع', 'بيع', 'اشتري', 'تملك', 'sale', 'buy'] as const;

/** Canonical property type → the words that signal it (already normalized). */
const PROPERTY_TYPES: Record<string, readonly string[]> = {
  apartment: ['شقه', 'شقق', 'apartment', 'flat'],
  villa: ['فيلا', 'فيلات', 'فلل', 'villa'],
  duplex: ['دوبلكس', 'duplex'],
  penthouse: ['بنتهاوس', 'بنت هاوس', 'penthouse'],
  studio: ['استوديو', 'ستوديو', 'studio'],
  chalet: ['شاليه', 'شاليهات', 'chalet'],
  townhouse: ['تاون هاوس', 'تاونهاوس', 'townhouse'],
  twinhouse: ['توين هاوس', 'توينهاوس', 'twinhouse'],
  office: ['مكتب', 'مكاتب', 'اداري', 'office'],
  commercial: ['محل', 'محلات', 'تجاري', 'commercial', 'shop'],
  land: ['ارض', 'اراضي', 'قطعه', 'land'],
};

const ROOM_WORDS = ['غرفه', 'غرف', 'اوضه', 'اوض', 'غرفه نوم', 'rooms', 'bedroom'];

export function extractDealType(norm: string): DealType | undefined {
  if (containsAny(norm, RENT_WORDS)) return 'rent';
  if (containsAny(norm, SALE_WORDS)) return 'sale';
  return undefined;
}

export function extractPropertyType(norm: string): string | undefined {
  for (const [key, words] of Object.entries(PROPERTY_TYPES)) {
    if (containsAny(norm, words)) return key;
  }
  return undefined;
}

export function extractCity(norm: string): string | undefined {
  // Recognition + canonical display label come from the shared taxonomy, which
  // also knows the catalog spelling variants (الرياض/Riyadh, جدة/جده).
  return matchCityLabel(norm);
}

export function extractRooms(norm: string): number | undefined {
  // "غرفتين" / "اوضتين" → 2 (Arabic dual) when no explicit number present.
  if (/غرفتين|اوضتين|اودتين/.test(norm)) return 2;
  // A number adjacent to a room word, in either order: "3 غرف" or "غرف 3".
  const before = norm.match(/(\d+)\s*(?:غرفه|غرف|اوضه|اوض|rooms?|bedrooms?)/);
  if (before) return clampRooms(Number(before[1]));
  const after = norm.match(/(?:غرفه|غرف|اوضه|اوض)\s*(\d+)/);
  if (after) return clampRooms(Number(after[1]));
  return undefined;
}

function clampRooms(n: number): number | undefined {
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(n, 20);
}

/**
 * Budget as an upper bound. Understands "مليون"/"م" (×1e6) and "الف"/"k"
 * (×1e3) multipliers, plain large numbers, and decimals like "2.5 مليون".
 * Only fires near a money cue (currency/budget word or a multiplier) so a bare
 * "3 غرف" isn't mistaken for a budget.
 */
export function extractBudget(norm: string): number | undefined {
  const millionMatch = norm.match(/(\d+(?:\.\d+)?)\s*(?:مليون|m\b)/);
  if (millionMatch) return Math.round(Number(millionMatch[1]) * 1_000_000);

  const thousandMatch = norm.match(/(\d+(?:\.\d+)?)\s*(?:الف|k\b)/);
  if (thousandMatch) return Math.round(Number(thousandMatch[1]) * 1_000);

  // Bare number only when a money cue is in the sentence.
  const moneyCue = containsAny(norm, ['ميزانيه', 'ميزانيتي', 'سعر', 'بسعر', 'جنيه', 'ج', 'حدود', 'budget', 'price']);
  if (moneyCue) {
    const plain = norm.match(/(\d{4,})/);
    if (plain) return Number(plain[1]);
  }
  return undefined;
}

/** Area as a lower bound in m². Fires only next to a metre cue. */
export function extractArea(norm: string): number | undefined {
  const m = norm.match(/(\d{2,5})\s*(?:متر|م2|m2|sqm|مسطح)/);
  if (m) return Number(m[1]);
  return undefined;
}

/** Pull every slot present in one pass. Absent values stay undefined. */
export function extractSlots(norm: string): Slots {
  const slots: Slots = {};
  const dealType = extractDealType(norm);
  if (dealType) slots.dealType = dealType;
  const propertyType = extractPropertyType(norm);
  if (propertyType) slots.propertyType = propertyType;
  const city = extractCity(norm);
  if (city) slots.city = city;
  const minRooms = extractRooms(norm);
  if (minRooms !== undefined) slots.minRooms = minRooms;
  const budgetMax = extractBudget(norm);
  if (budgetMax !== undefined) slots.budgetMax = budgetMax;
  const areaMin = extractArea(norm);
  if (areaMin !== undefined) slots.areaMin = areaMin;
  return slots;
}

export const ROOM_KEYWORDS = ROOM_WORDS;

const RESET_VERBS = ['غير', 'تغيير', 'عدل', 'بدل', 'change', 'edit'];

/**
 * Detect a "change the X" request (e.g. "غيّر الميزانية", "عدّل المدينة") so the
 * engine can clear that one slot and re-ask, instead of re-running the search.
 * Returns the slot to reset, or null.
 */
export function detectSlotReset(norm: string): SlotField | null {
  if (!containsAny(norm, RESET_VERBS)) return null;
  if (containsAny(norm, ['ميزاني', 'سعر', 'budget', 'price'])) return 'budgetMax';
  if (containsAny(norm, ['مدين', 'منطق', 'محافظ', 'city', 'area'])) return 'city';
  if (containsAny(norm, ['نوع', 'type'])) return 'propertyType';
  if (containsAny(norm, ['غرف', 'اوض', 'room'])) return 'minRooms';
  return null;
}
