import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Observable } from 'rxjs';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { isSalesIdInScope } from '../../../common/utils/sales-scope';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Enforces row-level lead scope before body validation.
 * Must be a route-level interceptor (not a guard) so it runs after
 * TenantContextInterceptor has established the ALS tenant context,
 * but before ValidationPipe processes the request body.
 *
 * Policy: ADMIN → pass. SALES → assignedSalesId must equal self.
 * SALES_MANAGER → lead must be assigned to self or a team member.
 */
@Injectable()
export class LeadScopeGuard implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const req = context
      .switchToHttp()
      .getRequest<{ user?: AuthUser; params?: Record<string, string> }>();
    const user = req.user;

    if (user && user.role !== UserRole.ADMIN) {
      const id = req.params?.['id'];
      if (id && UUID_RE.test(id)) {
        const lead = await this.prisma.lead.findUnique({
          where: { id },
          select: { assignedSalesId: true },
        });
        const ok = await isSalesIdInScope(this.prisma, user, lead?.assignedSalesId ?? null);
        if (!ok) throw new ForbiddenException('Record is outside your team');
      }
    }

    return next.handle();
  }
}
