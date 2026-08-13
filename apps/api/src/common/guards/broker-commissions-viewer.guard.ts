import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { enterTenantContext } from '../tenant/tenant-context';

/**
 * Runs AFTER BrokerScopeGuard. Blocks access to commission and payout reads
 * when the broker user's `canViewCommissions` flag is false. Primary-contact
 * and manage-team flags do NOT bypass this — financial visibility is a
 * separate, explicit grant that admins/managers can revoke independently.
 */
@Injectable()
export class BrokerCommissionsViewerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      user?: { companyId?: string | null };
      brokerUserId?: string;
    }>();
    if (!req.brokerUserId) {
      throw new ForbiddenException('Broker scope not resolved');
    }

    const companyId = req.user?.companyId ?? null;
    if (!companyId) {
      throw new ForbiddenException('Broker account is not associated with a company');
    }

    enterTenantContext({ companyId, bypass: false, isPublic: false });

    const me = await this.prisma.brokerUser.findUnique({
      where: { id: req.brokerUserId! },
      select: { canViewCommissions: true },
    });
    if (!me?.canViewCommissions) {
      throw new ForbiddenException(
        'لا تملك صلاحية الاطلاع على البيانات المالية للوسيط',
      );
    }
    return true;
  }
}
