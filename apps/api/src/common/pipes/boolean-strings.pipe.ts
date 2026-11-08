import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { getMetadataStorage } from 'class-validator';
import { defaultMetadataStorage } from 'class-transformer/cjs/storage';

/**
 * The global ValidationPipe converts implicitly, and `Boolean("false")` is
 * true: `?withoutPlan=false` filtered exactly like `?withoutPlan=true`, and a
 * string "false" in a body switched a flag on (QA, F-075). For the properties
 * a DTO declares `@IsBoolean()` this reads the strings true/false/1/0 as what
 * they say and refuses any other string. Real booleans pass untouched.
 * Runs before the ValidationPipe.
 */
@Injectable()
export class BooleanStringsPipe implements PipeTransform {
  transform(value: unknown, meta: ArgumentMetadata): unknown {
    if (meta.type === 'custom' || !meta.metatype || value === null || typeof value !== 'object') return value;
    return normalize(value, meta.metatype as new () => object, 0);
  }
}

const NESTED_MAX_DEPTH = 6;

function normalize(value: unknown, cls: new () => object, depth: number): unknown {
  if (Array.isArray(value)) return value.map((v) => normalize(v, cls, depth));
  if (value === null || typeof value !== 'object' || depth > NESTED_MAX_DEPTH) return value;
  const metas = getMetadataStorage().getTargetValidationMetadatas(cls, undefined as unknown as string, false, false);
  const booleans = new Set(metas.filter((m) => m.name === 'isBoolean' && !m.each).map((m) => m.propertyName));
  const nested = new Set(metas.filter((m) => m.type === 'nestedValidation').map((m) => m.propertyName));
  const out: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  for (const key of Object.keys(out)) {
    const v = out[key];
    if (booleans.has(key) && typeof v === 'string') {
      const s = v.trim().toLowerCase();
      if (s === 'true' || s === '1') out[key] = true;
      else if (s === 'false' || s === '0') out[key] = false;
      else throw new BadRequestException(`${key} must be a boolean value`);
    } else if (nested.has(key) && v !== null && typeof v === 'object') {
      const type = defaultMetadataStorage.findTypeMetadata(cls, key)?.typeFunction() as (new () => object) | undefined;
      if (type) out[key] = normalize(v, type, depth + 1);
    }
  }
  return out;
}
