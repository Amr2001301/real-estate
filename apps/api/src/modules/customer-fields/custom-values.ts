import { BadRequestException } from '@nestjs/common';
import type { CustomerFieldType } from './dto/customer-field.dto';

export interface FieldDef {
  key: string;
  type: string;
  options: string[];
  active: boolean;
  label: unknown;
}

export type CustomValues = Record<string, string | number>;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const CUSTOM_TEXT_MAX = 300;

function labelOf(f: FieldDef): string {
  const l = (f.label ?? {}) as { ar?: string; en?: string };
  return l.ar || l.en || f.key;
}

function isDay(v: string): boolean {
  if (!DAY.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** One value as stored, or null when it clears the field. */
function normalize(f: FieldDef, raw: unknown): string | number | null {
  if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) return null;
  const bad = (why: string) => new BadRequestException(`«${labelOf(f)}»: ${why}`);
  switch (f.type as CustomerFieldType) {
    case 'NUMBER': {
      const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.trim()) : NaN;
      if (!Number.isFinite(n)) throw bad('رقم غير صالح');
      return n;
    }
    case 'DATE': {
      if (typeof raw !== 'string' || !isDay(raw.trim())) throw bad('تاريخ غير صالح');
      return raw.trim();
    }
    case 'SELECT': {
      if (typeof raw !== 'string' || !f.options.includes(raw.trim())) throw bad('اختيار غير موجود');
      return raw.trim();
    }
    default: {
      if (typeof raw !== 'string' && typeof raw !== 'number') throw bad('قيمة غير صالحة');
      const s = String(raw).trim();
      if (s.length > CUSTOM_TEXT_MAX) throw bad(`حتى ${CUSTOM_TEXT_MAX} حرف`);
      return s;
    }
  }
}

/**
 * The customer's extra values after an edit: `input` is merged into `stored`
 * key by key, each checked against the company's field. A key the company
 * has no field for is refused; a field turned off keeps what it holds (edit
 * forms resend every value) and takes no new one; null or '' clears.
 */
export function mergeCustomValues(fields: FieldDef[], stored: unknown, input: Record<string, unknown>): CustomValues {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const out: CustomValues = {};
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
    for (const [k, v] of Object.entries(stored as Record<string, unknown>)) {
      if (typeof v === 'string' || typeof v === 'number') out[k] = v;
    }
  }
  for (const [key, raw] of Object.entries(input)) {
    const f = byKey.get(key);
    if (!f) throw new BadRequestException(`لا توجد خانة «${key}» في بيانات العملاء`);
    if (!f.active) continue;
    const v = normalize(f, raw);
    if (v === null) delete out[key];
    else out[key] = v;
  }
  return out;
}
