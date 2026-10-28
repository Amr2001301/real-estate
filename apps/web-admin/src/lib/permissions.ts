import { cache } from 'react';
import { api, safe } from './api';

/**
 * The permission codes that count for the signed-in user (PRM — the
 * permission opens the page). An admin gets every code; anyone else their
 * own minus the admin-only ones (GET /me/permissions). Loaded once per
 * request; an error leaves the set empty, so nothing extra opens.
 */
export const getMyCodes = cache(async (): Promise<Set<string>> => {
  const res = await safe(api.get<{ codes: string[] }>('/me/permissions'));
  return new Set(res.data?.codes ?? []);
});

/** True when the user holds any of the codes. */
export function hasAny(codes: ReadonlySet<string>, ...wanted: string[]): boolean {
  return wanted.some((c) => codes.has(c));
}

/** Shorthand for a page: does the signed-in user hold any of these codes? */
export async function can(...wanted: string[]): Promise<boolean> {
  return hasAny(await getMyCodes(), ...wanted);
}
