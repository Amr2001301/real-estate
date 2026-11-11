import { BadRequestException } from '@nestjs/common';

/**
 * «قيمة وحدتك»: what an owner's unit is worth today, from the company's own
 * current prices for units like it in the same project, against what they
 * paid (the contract's net price, without the instalment markup).
 *
 * Today's price per meter, first that exists:
 *   1. units for sale of the same model,
 *   2. units for sale of the same type,
 *   3. the company's own figure for the type (set when the type sold out),
 *   4. units for sale of the same usage (residential, commercial…),
 *   5. the company's own figure for the whole project.
 * None → no value is shown (decided: never a guess).
 */

export const UNIT_VALUE_KEYS = {
  enabled: 'unitValue.enabled',
  showDecrease: 'unitValue.showDecrease',
} as const;

/** Off until the company turns it on; only a rise is shown unless it asks for both. */
export const UNIT_VALUE_DEFAULTS = { enabled: false, showDecrease: false };

const bool = (k: string, v: unknown) => {
  if (typeof v !== 'boolean') throw new BadRequestException(`${k}: must be a boolean`);
};
export const UNIT_VALUE_VALIDATORS: Record<string, (key: string, v: unknown) => void> = {
  [UNIT_VALUE_KEYS.enabled]: bool,
  [UNIT_VALUE_KEYS.showDecrease]: bool,
};

export function resolveUnitValueSettings(rows: Array<{ key: string; value: unknown }>) {
  const get = (key: string, fallback: boolean) => {
    const v = rows.find((r) => r.key === key)?.value;
    return typeof v === 'boolean' ? v : fallback;
  };
  return {
    enabled: get(UNIT_VALUE_KEYS.enabled, UNIT_VALUE_DEFAULTS.enabled),
    showDecrease: get(UNIT_VALUE_KEYS.showDecrease, UNIT_VALUE_DEFAULTS.showDecrease),
  };
}

export type RateBasis = 'MODEL' | 'TYPE' | 'USAGE' | 'PROJECT';
export type RateSource = 'MARKET' | 'MANUAL';

export interface PricedUnit {
  price: number;
  area: number;
  type: string;
  usage: string;
  modelId: string | null;
}

export interface OwnedUnit {
  type: string;
  usage: string;
  modelId: string | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The average price per gross meter of [units] (those with an area), or null. */
export function averagePerMeter(units: ReadonlyArray<{ price: number; area: number }>): number | null {
  const rated = units.filter((u) => u.area > 0 && u.price > 0);
  if (rated.length === 0) return null;
  return round2(rated.reduce((s, u) => s + u.price / u.area, 0) / rated.length);
}

/**
 * Today's price per meter for [owned], from the units for sale in its project
 * and the company's own figures (keyed by unit type; null = the project).
 */
export function currentRate(
  owned: OwnedUnit,
  forSale: ReadonlyArray<PricedUnit>,
  manual: ReadonlyMap<string | null, number>,
): { pricePerMeter: number; basis: RateBasis; source: RateSource } | null {
  const sameType = (u: PricedUnit) => u.type.toLowerCase() === owned.type.toLowerCase();
  const steps: Array<() => { pricePerMeter: number; basis: RateBasis; source: RateSource } | null> = [
    () => {
      const r = owned.modelId ? averagePerMeter(forSale.filter((u) => u.modelId === owned.modelId)) : null;
      return r === null ? null : { pricePerMeter: r, basis: 'MODEL', source: 'MARKET' };
    },
    () => {
      const r = averagePerMeter(forSale.filter(sameType));
      return r === null ? null : { pricePerMeter: r, basis: 'TYPE', source: 'MARKET' };
    },
    () => {
      const r = manualFor(manual, owned.type);
      return r === undefined ? null : { pricePerMeter: r, basis: 'TYPE', source: 'MANUAL' };
    },
    () => {
      const r = averagePerMeter(forSale.filter((u) => u.usage === owned.usage));
      return r === null ? null : { pricePerMeter: r, basis: 'USAGE', source: 'MARKET' };
    },
    () => {
      const r = manual.get(null);
      return r === undefined ? null : { pricePerMeter: r, basis: 'PROJECT', source: 'MANUAL' };
    },
  ];
  for (const step of steps) {
    const hit = step();
    if (hit) return hit;
  }
  return null;
}

/** The company's own figure for a type, matching the code in any case. */
function manualFor(manual: ReadonlyMap<string | null, number>, type: string): number | undefined {
  for (const [k, v] of manual) if (k !== null && k.toLowerCase() === type.toLowerCase()) return v;
  return undefined;
}

/** Today's value and the change against the price paid. */
export function unitValue(purchasePrice: number, area: number, pricePerMeter: number) {
  const currentValue = round2(pricePerMeter * area);
  const gain = round2(currentValue - purchasePrice);
  const gainPct = purchasePrice > 0 ? Math.round((gain / purchasePrice) * 1000) / 10 : 0;
  return { currentValue, gain, gainPct };
}

/** Shown when the value rose — or fell too, if the company chose to show that. */
export function isShown(gain: number, showDecrease: boolean): boolean {
  return gain > 0 || (showDecrease && gain < 0);
}

export interface HistoryPoint {
  date: string;
  pricePerMeter: number;
}

/**
 * The price per meter from the purchase to today: the price paid, the rates
 * recorded since (the last one of each month before this one), then today's.
 */
export function valueHistory(
  purchasedAt: Date,
  purchasePerMeter: number,
  recorded: ReadonlyArray<{ recordedAt: Date; pricePerMeter: number }>,
  today: { at: Date; pricePerMeter: number },
): HistoryPoint[] {
  const byMonth = new Map<string, { recordedAt: Date; pricePerMeter: number }>();
  for (const r of [...recorded].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime())) {
    if (r.recordedAt <= purchasedAt || r.recordedAt >= today.at) continue;
    byMonth.set(r.recordedAt.toISOString().slice(0, 7), r);
  }
  // Today's point stands for the current month.
  byMonth.delete(today.at.toISOString().slice(0, 7));
  return [
    { date: purchasedAt.toISOString(), pricePerMeter: round2(purchasePerMeter) },
    ...[...byMonth.values()].map((r) => ({ date: r.recordedAt.toISOString(), pricePerMeter: round2(r.pricePerMeter) })),
    { date: today.at.toISOString(), pricePerMeter: round2(today.pricePerMeter) },
  ];
}
