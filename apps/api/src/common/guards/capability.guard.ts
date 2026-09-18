/**
 * MT-039 — CapabilityGuard  (Phase 2 update)
 *
 * Two enforcement mechanisms in one pass:
 *
 * 1. FEATURE GATE (@RequireCapability decorator)
 *    Reads @RequireCapability('key') metadata from the handler/class and calls
 *    capabilityService.requireCapability(). Applied to broker-*, maintenance,
 *    and me/* controllers explicitly.
 *
 * 2. APP-LEVEL ALWAYS-CHECK (Phase 2 route-level backstop)
 *    Regardless of any decorator, staff roles require feature.staffApp and
 *    customer roles require feature.customerApp.  This catches tokens that
 *    were issued via a path that bypassed the login-level check (e.g. a token
 *    still in-flight when an app was disabled, or issued via the legacy
 *    loginEmail path).
 *
 * Rules common to both checks:
 * - No authenticated user → guard passes (public routes).
 * - SUPER_ADMIN (companyId = null) → always passes.
 * - Redis unavailable → DB fallback (never fail open).
 */

import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_CAPABILITY_KEY } from '../decorators/require-capability.decorator';
import { CapabilityService } from '../capabilities/capability.service';
import { STAFF_SEAT_ROLES } from '../capabilities/capability-schema';
import type { UserRole } from '@prisma/client';

interface AuthUser {
  sub: string;
  role: UserRole;
  companyId: string | null;
}

const CUSTOMER_ROLES: readonly UserRole[] = ['CLIENT', 'CUSTOMER'];

@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly capabilityService: CapabilityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = req.user;

    // No authenticated user → public route, pass through.
    if (!user) return true;

    // SUPER_ADMIN has no tenant company — all capability checks bypass.
    if (user.role === 'SUPER_ADMIN') return true;

    const { companyId } = user;
    if (!companyId) {
      // Non-SUPER_ADMIN without a company — deny gracefully.
      throw new ForbiddenException({
        message: 'No tenant context for capability check',
        code: 'CAPABILITY_NOT_ENABLED',
      });
    }

    // ── 1. App-level backstop (always runs, no decorator needed) ─────────────
    const staffRoles: readonly UserRole[] = STAFF_SEAT_ROLES;
    if (staffRoles.includes(user.role)) {
      await this.capabilityService.requireCapability(companyId, 'feature.staffApp');
    } else if ((CUSTOMER_ROLES as readonly UserRole[]).includes(user.role)) {
      await this.capabilityService.requireCapability(companyId, 'feature.customerApp');
    }

    // ── 2. Feature gate (@RequireCapability decorator) ────────────────────────
    const capability = this.reflector.getAllAndOverride<string | undefined>(
      REQUIRE_CAPABILITY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!capability) return true;

    await this.capabilityService.requireCapability(companyId, capability);
    return true;
  }
}
