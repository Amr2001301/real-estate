/**
 * BRK-5 — how well a listing fits what a lead is looking for. Pure, so the
 * lead's matches, the listing's matching leads and the new-listing notice
 * all score the same way.
 *
 * A requirement's deal kinds are a hard filter, and so is a price more than
 * 10% over the budget. Every other criterion the lead gave adds points; the
 * score is the share of the points the listing could have earned.
 */
import { ListingKind } from '@prisma/client';

export type MatchReason = 'budget' | 'budgetNear' | 'city' | 'unitType' | 'bedrooms' | 'area';

export interface MatchListing {
  kind: ListingKind;
  price: number;
  city: string;
  district: string | null;
  compound: string | null;
  unitType: string;
  bedrooms: number | null;
  area: number;
}

export interface MatchRequirement {
  kinds: ListingKind[];
  budgetMin: number | null;
  budgetMax: number | null;
  cities: string[];
  unitTypes: string[];
  bedroomsMin: number | null;
  areaMin: number | null;
}

/** Over budget by up to this much still shows, as "near". */
export const BUDGET_STRETCH = 0.1;
/** Below this score a listing is not offered as a match. */
export const MIN_MATCH_SCORE = 50;

const norm = (s: string) =>
  s.trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');

export function matchListing(
  l: MatchListing,
  r: MatchRequirement,
): { score: number; reasons: MatchReason[] } | null {
  if (r.kinds.length && !r.kinds.includes(l.kind)) return null;
  if (r.budgetMax !== null && l.price > r.budgetMax * (1 + BUDGET_STRETCH)) return null;

  let points = 0;
  let max = 0;
  const reasons: MatchReason[] = [];
  if (r.budgetMin !== null || r.budgetMax !== null) {
    max += 30;
    const aboveMin = r.budgetMin === null || l.price >= r.budgetMin;
    const withinMax = r.budgetMax === null || l.price <= r.budgetMax;
    if (aboveMin && withinMax) {
      points += 30;
      reasons.push('budget');
    } else if (aboveMin) {
      points += 15;
      reasons.push('budgetNear');
    }
  }
  if (r.cities.length) {
    max += 25;
    const place = [l.city, l.district, l.compound].filter(Boolean).map((p) => norm(p!));
    if (r.cities.some((c) => place.some((p) => p.includes(norm(c)) || norm(c).includes(p)))) {
      points += 25;
      reasons.push('city');
    }
  }
  if (r.unitTypes.length) {
    max += 15;
    if (r.unitTypes.includes(l.unitType)) {
      points += 15;
      reasons.push('unitType');
    }
  }
  if (r.bedroomsMin !== null) {
    max += 15;
    if (l.bedrooms !== null && l.bedrooms >= r.bedroomsMin) {
      points += 15;
      reasons.push('bedrooms');
    }
  }
  if (r.areaMin !== null) {
    max += 15;
    if (l.area >= r.areaMin) {
      points += 15;
      reasons.push('area');
    }
  }
  // Only the kind was asked for: every listing of that kind fits.
  if (max === 0) return r.kinds.length ? { score: 100, reasons } : null;
  return { score: Math.round((points / max) * 100), reasons };
}
