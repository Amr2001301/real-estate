import { registerDecorator, ValidationOptions } from 'class-validator';

/** "YYYY-MM-DD" naming a real calendar day (2026-02-30 is not one). */
export function isCalendarDay(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/**
 * Rejects a day that does not exist. A bare date pattern let 2026-02-30
 * through, and `new Date()` then stored it as 2026-03-02.
 */
export function IsCalendarDay(options?: ValidationOptions) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'isCalendarDay',
      target: target.constructor,
      propertyName,
      options: { message: `${propertyName} must be a real day, YYYY-MM-DD`, ...options },
      validator: { validate: isCalendarDay },
    });
}
