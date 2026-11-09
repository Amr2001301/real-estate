import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/**
 * Refuses a request whose body, query or path carries a NUL character (\u0000)
 * anywhere in a string. PostgreSQL cannot store it in text, so it used to
 * surface as a 500 — and, on the public info-request form, after the visitor's
 * lead had already been written (QA run 1, F-045). Runs before validation.
 */
@Injectable()
export class RejectNulBytesPipe implements PipeTransform {
  transform<T>(value: T): T {
    if (containsNul(value, 0)) {
      throw new BadRequestException('Invalid characters in the request');
    }
    return value;
  }
}

function containsNul(v: unknown, depth: number): boolean {
  if (typeof v === 'string') return v.includes('\u0000');
  if (depth > 12 || v === null || typeof v !== 'object') return false;
  if (Array.isArray(v)) return v.some((x) => containsNul(x, depth + 1));
  // Keys too: a NUL in a JSON key reaches Prisma JSON columns the same way.
  return Object.entries(v as Record<string, unknown>).some(
    ([k, x]) => k.includes('\u0000') || containsNul(x, depth + 1),
  );
}
