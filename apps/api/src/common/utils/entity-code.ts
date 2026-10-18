import { ConflictException } from '@nestjs/common';
import { isUniqueConflictOn } from './contract-number';

/** 2–64 chars, uppercase ASCII letters + digits + hyphens, starts with letter or digit. */
export const ENTITY_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{1,63}$/;

/** Trim whitespace and uppercase. Applied by @Transform on all three create DTOs and the importer. */
export function normalizeEntityCode(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

/**
 * `.catch()` handler for a create/update that writes a code: a taken code
 * (the unique index on it) becomes a 409 naming what holds it, instead of a 500.
 */
export function codeTaken(holder: string) {
  // e.g. holder = 'لمشروع آخر في الشركة'
  return (e: unknown): never => {
    if (isUniqueConflictOn(e, 'code')) {
      throw new ConflictException(`هذا الكود مستخدم بالفعل ${holder} — اختر كوداً مختلفاً`);
    }
    throw e;
  };
}
