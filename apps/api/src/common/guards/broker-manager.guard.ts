import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Runs AFTER BrokerScopeGuard. Allows only broker users who can manage their
 * firm's team — i.e. the primary contact OR anyone flagged with
 * `canManageBrokerUsers`. Normal broker agents are rejected with 403.
 */
@Injectable()
export class BrokerManagerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      brokerUserId?: string;
    }>();
    if (!req.brokerUserId) {
      // BrokerScopeGuard must have populated this — if it didn't, the route
      // is misconfigured.
      throw new ForbiddenException('Broker scope not resolved');
    }

    const me = await this.prisma.brokerUser.findUnique({
      where: { id: req.brokerUserId },
      select: { isPrimaryContact: true, canManageBrokerUsers: true },
    });
    if (!me) {
      throw new ForbiddenException('Broker profile not found');
    }
    if (!me.isPrimaryContact && !me.canManageBrokerUsers) {
      throw new ForbiddenException(
        'إدارة الفريق متاحة فقط للمدير أو جهة الاتصال الرئيسية',
      );
    }
    return true;
  }
}
