/** 2–64 chars, uppercase ASCII letters + digits + hyphens, starts with letter or digit. */
export const ENTITY_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{1,63}$/;

/** Trim whitespace and uppercase. Applied by @Transform on all three create DTOs and the importer. */
export function normalizeEntityCode(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}
