import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
 */
@Injectable()
export class BrokerScopeGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      user?: { sub?: string; role?: string };
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

    const brokerUser = await this.prisma.brokerUser.findUnique({
      where: { userId: user.sub },
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
