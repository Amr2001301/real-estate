import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { enterTenantContext } from '../tenant/tenant-context';

export interface BrokerScopeContext {
  brokerId: string;
  brokerUserId: string;
  brokerAgentUserId: string;
}

/**
 * Gate for /portal/* endpoints. Verifies the caller:
 *   - has a JWT with role === BROKER (set by JwtAuthGuard upstream),
 *   - is linked to an ACTIVE BrokerUser row,
 *   - whose Broker firm is ACTIVE.
 *
 * On success, attaches { brokerId, brokerUserId, brokerAgentUserId } to the
 * request so portal services can scope their queries. The brokerId is NEVER
 * read from query/body — it is resolved from the authenticated identity here.
 *
 * Product A assumption: user.companyId points to the DEVELOPER company the
 * broker agent works for, not to a brokerage firm's own tenant. Product B
 * (an independent brokerage Company) will need a different resolution path.
 */
@Injectable()
export class BrokerScopeGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      user?: { sub?: string; role?: string; companyId?: string | null };
      brokerId?: string;
      brokerUserId?: string;
      brokerAgentUserId?: string;
    }>();

    const user = req.user;
    if (!user || !user.sub) {
      throw new ForbiddenException('Authentication required');
    }
    if (user.role !== 'BROKER') {
      throw new ForbiddenException('Broker portal access requires BROKER role');
    }

    // Guards run before TenantContextInterceptor establishes the ALS context.
    // Prisma 5 uses a lazy proxy — middleware executes in a deferred microtask,
    // not in the synchronous call frame, so als.run() does not propagate context
    // to the middleware. Instead, enter the ALS context on the current async
    // resource now; TenantContextInterceptor will overwrite it with an identical
    // value when it runs after the guard chain completes.
    const companyId = user.companyId ?? null;
    if (!companyId) {
      throw new ForbiddenException('Broker account is not associated with a company');
    }

    enterTenantContext({ companyId, bypass: false, isPublic: false });

    const brokerUser = await this.prisma.brokerUser.findUnique({
      where: { userId: user.sub! },
      select: {
        id: true,
        userId: true,
        brokerId: true,
        status: true,
        broker: { select: { id: true, status: true } },
      },
    });

    if (!brokerUser) {
      throw new ForbiddenException('No broker profile attached to this user');
    }
    if (brokerUser.status !== 'ACTIVE') {
      throw new ForbiddenException('Broker user is not active');
    }
    if (brokerUser.broker.status !== 'ACTIVE') {
      throw new ForbiddenException('Broker firm is not active');
    }

    req.brokerId = brokerUser.brokerId;
    req.brokerUserId = brokerUser.id;
    req.brokerAgentUserId = brokerUser.userId;
    return true;
  }
}
