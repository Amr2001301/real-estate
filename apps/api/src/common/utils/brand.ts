import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * The Devora brand logo (PNG) used in report headers. Loaded once and cached.
 * Returns null if the asset is unavailable (e.g. a slim prod image that ships
 * only dist/) so callers degrade gracefully to a text-only banner — a report
 * is never broken by a missing logo.
 *
 * Resolved relative to this file so it works from both src (ts-jest / dev) and
 * dist, regardless of the process cwd.
 */
let cache: Buffer | null | undefined;

export function brandLogoPng(): Buffer | null {
  if (cache !== undefined) return cache;
  try {
    cache = readFileSync(resolve(__dirname, '../../../assets/brand/devora-logo.png'));
  } catch {
    cache = null;
  }
  return cache;
}
