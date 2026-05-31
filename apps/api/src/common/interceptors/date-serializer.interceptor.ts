import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

function serializeDates(value: unknown): unknown {
  // Binary/stream responses (e.g. a StreamableFile for the XLSX/CSV downloads)
  // must pass through untouched. Rebuilding them via the generic object branch
  // below strips the StreamableFile prototype, so Nest can no longer detect it
  // with `instanceof` and JSON-serializes the wrapper instead of streaming the
  // bytes — which is exactly how the XLSX download ended up as one JSON cell.
  if (value instanceof StreamableFile || Buffer.isBuffer(value)) return value;
  if (value instanceof Date) return value.toISOString();
  // Prisma Decimal is an object; convert to string before generic object traversal
  if (value instanceof Prisma.Decimal) return value.toString();
  if (Array.isArray(value)) return value.map(serializeDates);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializeDates(v);
    }
    return out;
  }
  return value;
}

@Injectable()
export class DateSerializerInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map(serializeDates));
  }
}
