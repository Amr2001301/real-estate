/**
 * MT-039 — CapabilityGuard
 *
 * Reads the @RequireCapability('key') decorator metadata and calls
 * CapabilityService.requireCapability() to enforce it.
 *
 * Rules:
 * - No decorator on handler/controller → guard passes (opt-in enforcement).
 * - SUPER_ADMIN (companyId = null) → guard passes (platform routes must not
 *   be inadvertently gated by tenant capabilities).
 * - Authenticated tenant user → companyId from req.user (JwtStrategy DB reload,
 *   never from JWT payload).
 * - Missing companyId for non-SUPER_ADMIN → denied (should not happen in normal
 *   operation, but defence-in-depth).
 */

import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_CAPABILITY_KEY } from '../decorators/require-capability.decorator';
import { CapabilityService } from '../capabilities/capability.service';

interface AuthUser {
  sub: string;
  role: string;
  companyId: string | null;
}

@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly capabilityService: CapabilityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const capability = this.reflector.getAllAndOverride<string | undefined>(
      REQUIRE_CAPABILITY_KEY,
      [context.getHandler(), context.getClass()],
    );
    // No requirement declared — pass through
    if (!capability) return true;

    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = req.user;
    if (!user) return false;

    // SUPER_ADMIN has no tenant company — platform routes bypass capability checks
    if (user.role === 'SUPER_ADMIN') return true;

    const { companyId } = user;
    if (!companyId) {
      // Non-SUPER_ADMIN without a company — deny gracefully
      throw new ForbiddenException({
        message: 'No tenant context for capability check',
        code: 'CAPABILITY_NOT_ENABLED',
        capability,
      });
    }

    // requireCapability throws ForbiddenException with code CAPABILITY_NOT_ENABLED
    await this.capabilityService.requireCapability(companyId, capability);
    return true;
  }
}
