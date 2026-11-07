import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { maskSensitiveFields } from '../utils/sensitive-fields';

const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * A download of company data (report, unit, payment lists as CSV / XLSX / PDF):
 * a GET, so the interceptor skipped it — bulk customer and money data could leave
 * with no trace of who took it (QA F-058).
 */
const EXPORT_PATH = /\/export(\.(csv|xlsx|pdf))?$/i;

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const method: string = req.method;
    const url: string = req.originalUrl ?? req.url ?? '';
    const pathname = url.split('?')[0] ?? '';
    if (method === 'GET' && EXPORT_PATH.test(pathname)) return this.auditExport(req, pathname, next);
    if (!MUTATING.has(method)) return next.handle();

    if (url.includes('/auth/otp') || url.includes('/auth/login')) return next.handle();

    const userId: string | undefined = req.user?.sub;
    const ip = req.ip;
    const action = method;
    const entityType = url.split('/').filter(Boolean).slice(0, 2).join('/');

    return next.handle().pipe(
      tap({
        next: (response) => {
          this.prisma.auditLog
            .create({
              data: {
                actorId: userId ?? null,
                action,
                entityType,
                entityId: this.extractId(response, req),
                after: this.safeJson(response),
                ip,
              },
            })
            .catch(() => undefined);
        },
      }),
    );
  }

  /** Record who downloaded what (path and filters) once the export has been produced. */
  private auditExport(
    req: { user?: { sub?: string }; ip?: string; query?: unknown },
    pathname: string,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      tap({
        next: () => {
          this.prisma.auditLog
            .create({
              data: {
                actorId: req.user?.sub ?? null,
                action: 'EXPORT',
                entityType: pathname.split('/').filter(Boolean).slice(0, 3).join('/'),
                entityId: null,
                after: this.safeJson({ path: pathname, filters: req.query ?? {} }),
                ip: req.ip,
              },
            })
            .catch(() => undefined);
        },
      }),
    );
  }

  private extractId(response: unknown, req: { params?: Record<string, string> }): string | null {
    if (response && typeof response === 'object' && 'id' in response) {
      const id = (response as { id?: unknown }).id;
      if (typeof id === 'string') return id;
    }
    return req.params?.id ?? null;
  }

  private safeJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    try {
      // Mask sensitive fields (passwords, tokens, OTPs, secrets) BEFORE the
      // JSON roundtrip so they never reach the AuditLog row.
      const sanitised = maskSensitiveFields(value);
      const parsed = JSON.parse(JSON.stringify(sanitised));
      return parsed ?? Prisma.JsonNull;
    } catch {
      return Prisma.JsonNull;
    }
  }
}
