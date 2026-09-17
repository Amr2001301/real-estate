/**
 * Tenant-facing capability endpoints — Phase 1.
 *
 * TENANCY:
 *  - Company ADMIN may read their own effective capabilities and usage.
 *  - Reading another company is structurally prevented (no companyId param —
 *    the authenticated user's companyId is the only possible scope).
 *  - SUPER_ADMIN is excluded; they use the super-admin endpoints.
 *  - No write endpoints in Phase 1 — company admins cannot modify overrides.
 */

import { Controller, Get, Module, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CapabilityService } from '../../common/capabilities/capability.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { scopedUserCount } from '../../common/tenant/resolve-tenant-entity';

interface AuthenticatedRequest {
  user: { sub: string; role: string; companyId: string | null };
}

@Controller('capabilities')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SALES_MANAGER')
class CompanyCapabilitiesController {
  constructor(
    private readonly capabilityService: CapabilityService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Returns the plan-default / override / effective view for the authenticated
   * user's company.  Read-only; no companyId parameter (prevents cross-tenant).
   */
  @Get('me')
  async getMyCapabilities(@Req() req: AuthenticatedRequest) {
    const { companyId } = req.user;
    // companyId guaranteed by RolesGuard (non-SUPER_ADMIN have companyId)
    return this.capabilityService.getEffectiveCapabilities(companyId!);
  }

  /**
   * Returns current usage counts (units / users / projects) vs the effective limits
   * for the authenticated user's company.
   */
  @Get('me/usage')
  async getMyUsage(@Req() req: AuthenticatedRequest) {
    const { companyId } = req.user;
    const [effectiveView, unitCount, userCount, projectCount] = await Promise.all([
      this.capabilityService.getEffectiveCapabilities(companyId!),
      this.prisma.unit.count({ where: { companyId: companyId! } }),
      scopedUserCount(this.prisma, { role: { not: 'SUPER_ADMIN' } }),
      this.prisma.project.count({ where: { companyId: companyId! } }),
    ]);

    const getEffective = (key: string) =>
      effectiveView.keys.find((k) => k.key === key)?.effective ?? null;

    return {
      companyId,
      plan: effectiveView.plan,
      limits: {
        units:    { limit: getEffective('limit.maxUnits')    as number | null, used: unitCount },
        users:    { limit: getEffective('limit.maxUsers')    as number | null, used: userCount },
        projects: { limit: getEffective('limit.maxProjects') as number | null, used: projectCount },
      },
    };
  }
}

@Module({
  controllers: [CompanyCapabilitiesController],
})
export class CompanyCapabilitiesModule {}
