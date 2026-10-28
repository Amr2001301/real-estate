import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Optional } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { GRANTED_BY_KEY } from '../decorators/granted-by.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { STAFF_ROLES, effectiveCodes, loadHeldCodes, type ReqWithCodes } from '../permissions/staff-codes';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<ReqWithCodes>();
    const user = req.user;
    if (user?.role && required.includes(user.role)) return true;

    // PRM: a staff member outside the route's roles is let in by a code it
    // names with @GrantedBy, if they hold it.
    const granted = this.reflector.getAllAndOverride<string[] | undefined>(GRANTED_BY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (granted?.length && this.prisma && user?.sub && user.role && STAFF_ROLES.includes(user.role)) {
      const codes = effectiveCodes(user.role, await loadHeldCodes(this.prisma, req, user.sub));
      const code = granted.find((c) => codes.has(c));
      if (code) {
        req._grantedBy = code;
        return true;
      }
    }
    throw new ForbiddenException('Insufficient role');
  }
}
