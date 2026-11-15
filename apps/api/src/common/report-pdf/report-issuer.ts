import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Who asked for the report being built — its PDF and Excel files say so
 * («أصدره»). Set per export request by ReportIssuerInterceptor (scoped to its handler); the
 * shared document helpers (report-html, xlsx) read it, so every report
 * carries it without each one passing it along. Empty outside an export.
 */
const als = new AsyncLocalStorage<{ name: string }>();

/** The current export's issuer, or undefined (no export, or no name). */
export function reportIssuer(): string | undefined {
  const name = als.getStore()?.name?.trim();
  return name ? name : undefined;
}

/** Runs `fn` with `name` as the issuer (tests, jobs). */
export function runWithReportIssuer<T>(name: string, fn: () => T): T {
  return als.run({ name }, fn);
}
