'use server';

/** The API address another system sends a migration to (the same base as lead intake). */
export async function migrationApiBase(): Promise<string> {
  return (process.env.PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000').replace(/\/$/, '');
}
