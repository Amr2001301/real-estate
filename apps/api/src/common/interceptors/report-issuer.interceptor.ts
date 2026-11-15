import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { runWithReportIssuer } from '../report-pdf/report-issuer';
import { findTenantUser } from '../tenant/resolve-tenant-entity';

/** A file export: a PDF or Excel download, or an /export route. */
const EXPORT_PATH = /(\.(pdf|xlsx)$|\/export(\/|$))/i;

/**
 * Names the person who asked for an exported report, so its PDF / Excel
 * says who issued it. Runs after the tenant context (the user is read in the
 * caller's company), only on GET export routes of a signed-in user. A
 * failed lookup never fails the export: the file just carries no name.
 */
@Injectable()
export class ReportIssuerInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<{ method?: string; path?: string; url?: string; user?: { sub?: string } }>();
    const path = (req.path ?? req.url ?? '').split('?')[0] ?? '';
    const userId = req.user?.sub;
    if (req.method !== 'GET' || !userId || !EXPORT_PATH.test(path)) return next.handle();
    return new Observable((subscriber) => {
      // The user in the caller's company (none on a platform request).
      const lookup = async () => findTenantUser(this.prisma, userId, { fullName: true });
      lookup()
        .catch(() => null)
        .then((u) => {
          // Scoped to this request's handler: nothing leaks to the next one.
          runWithReportIssuer(u?.fullName ?? '', () => next.handle().subscribe(subscriber));
        });
    });
  }
}
