import { UnitFinishing, UnitOrientation, UnitView } from '@prisma/client';

/**
 * A unit's specs (F10) and their Arabic names — the catalogue import reads
 * either, and the export writes the Arabic.
 */
export const FINISHING_AR: Record<UnitFinishing, string> = {
  CORE_AND_SHELL: 'على الطوب',
  SEMI_FINISHED: 'نصف تشطيب',
  FULLY_FINISHED: 'تشطيب كامل',
  FURNISHED: 'مفروشة',
};

export const VIEW_AR: Record<UnitView, string> = {
  GARDEN: 'حديقة',
  POOL: 'حمام سباحة',
  LAGOON: 'لاجون',
  SEA: 'بحر',
  NILE: 'النيل',
  CLUB: 'النادي',
  LANDSCAPE: 'مساحات خضراء',
  MAIN_STREET: 'شارع رئيسي',
  SIDE_STREET: 'شارع جانبي',
};

export const ORIENTATION_AR: Record<UnitOrientation, string> = {
  NORTH: 'بحري',
  SOUTH: 'قبلي',
  EAST: 'شرقي',
  WEST: 'غربي',
  NORTH_EAST: 'بحري شرقي',
  NORTH_WEST: 'بحري غربي',
  SOUTH_EAST: 'قبلي شرقي',
  SOUTH_WEST: 'قبلي غربي',
};

/** A spec written as its code (any case, spaces or hyphens) or its Arabic name. */
export function parseSpec<T extends string>(labels: Record<T, string>, raw: string): T | undefined {
  const text = raw.trim();
  const code = text.toUpperCase().replace(/[\s-]+/g, '_');
  for (const [k, ar] of Object.entries(labels) as Array<[T, string]>) {
    if (k === code || ar === text) return k;
  }
  return undefined;
}
