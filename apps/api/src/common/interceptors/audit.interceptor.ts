import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const method: string = req.method;
    if (!MUTATING.has(method)) return next.handle();

    const url: string = req.originalUrl ?? req.url ?? '';
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

  private extractId(response: unknown, req: { params?: Record<string, string> }): string | null {
    if (response && typeof response === 'object' && 'id' in response) {
      const id = (response as { id?: unknown }).id;
      if (typeof id === 'string') return id;
    }
    return req.params?.id ?? null;
  }

  private safeJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    try {
      const parsed = JSON.parse(JSON.stringify(value));
      return parsed ?? Prisma.JsonNull;
    } catch {
      return Prisma.JsonNull;
    }
  }
}
