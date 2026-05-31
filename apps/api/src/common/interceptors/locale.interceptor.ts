import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

type Translatable = { ar?: unknown; en?: unknown };

function isTranslatable(v: unknown): v is Translatable {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const keys = Object.keys(v);
  if (keys.length === 0 || keys.length > 2) return false;
  return keys.every((k) => k === 'ar' || k === 'en');
}

function flatten(value: unknown, locale: 'ar' | 'en'): unknown {
  // Never traverse binary/stream responses (e.g. a StreamableFile download) —
  // rebuilding them as plain objects strips the prototype and breaks Nest's
  // streaming path. See date-serializer.interceptor for the same guard.
  if (value instanceof StreamableFile || Buffer.isBuffer(value)) return value;
  if (Array.isArray(value)) return value.map((v) => flatten(v, locale));
  if (isTranslatable(value)) {
    const ar = (value as Translatable).ar;
    const en = (value as Translatable).en;
    const picked = locale === 'ar' ? ar ?? en : en ?? ar;
    return typeof picked === 'string' ? picked : '';
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = flatten(v, locale);
    }
    return out;
  }
  return value;
}

@Injectable()
export class LocaleInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const header = (req.headers['accept-language'] as string) ?? '';
    const explicit = (req.headers['x-locale'] as string) ?? '';
    const candidate = (explicit || header).toLowerCase();
    const locale: 'ar' | 'en' = candidate.startsWith('en') ? 'en' : 'ar';
    req.locale = locale;

    // Skip flattening when client opts out (e.g., admin needing both ar/en for editing)
    const raw = req.headers['x-raw-translatable'] === '1';
    return next.handle().pipe(map((data) => (raw ? data : flatten(data, locale))));
  }
}
