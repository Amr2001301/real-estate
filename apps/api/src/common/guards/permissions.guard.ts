import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  PERMISSIONS_KEY,
  type PermissionsMeta,
} from '../decorators/permissions.decorator';
import { effectiveCodes, loadHeldCodes, type ReqWithCodes } from '../permissions/staff-codes';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip for non-HTTP contexts (queues, etc.) — they don't have @Permissions
    // metadata today.
    if (context.getType() !== 'http') return true;

    const meta = this.reflector.getAllAndOverride<PermissionsMeta | undefined>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    // Routes without @Permissions stay role-only — keeps the rollout opt-in.
    if (!meta || meta.codes.length === 0) return true;

    const req = context.switchToHttp().getRequest<ReqWithCodes>();
    const user = req.user;
    if (!user?.sub) {
      throw new ForbiddenException(this.missingPermissionBody(meta.codes));
    }

    if (meta.adminBypass && user.role === UserRole.ADMIN) return true;
    // The code that let the caller in through @GrantedBy (RolesGuard) is
    // their permission for this route.
    if (req._grantedBy) return true;

    // An admin-only code held by a non-admin (granted before PRM) never counts.
    const codes = effectiveCodes(user.role, await loadHeldCodes(this.prisma, req, user.sub));
    const granted = meta.codes.some((c) => codes.has(c));
    if (!granted) {
      throw new ForbiddenException(this.missingPermissionBody(meta.codes));
    }
    return true;
  }

  /**
   * Stable error shape — frontend can match `code === 'missing_permission'`
   * to render a precise empty state instead of a generic 403. We let NestJS
   * inject `statusCode` and `error` itself; emitting them here causes the
   * framework to overwrite/strip our custom fields.
   */
  private missingPermissionBody(codes: string[]) {
    return {
      message: `Missing permission: ${codes.join(' or ')}`,
      code: 'missing_permission',
      permissions: codes,
    };
  }
}
