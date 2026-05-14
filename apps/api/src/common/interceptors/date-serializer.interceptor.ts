import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

function serializeDates(value: unknown): unknown {
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
