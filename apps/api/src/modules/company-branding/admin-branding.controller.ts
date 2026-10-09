/**
 * Admin branding endpoint — scoped to the caller's own company.
 *
 * GET  /v1/company/branding  — read current branding (admin, raw DB values)
 * PATCH /v1/company/branding  — update branding fields + invalidate Redis cache
 *
 * Security guarantees:
 *   • @Roles(ADMIN) gates both routes — SALES/SALES_MANAGER get 403.
 *   • companyId is always sourced from the authenticated JWT (AuthUser.companyId),
 *     never from request body or path params. An ADMIN of company A can never
 *     modify company B's branding — they would need B's JWT.
 */

import { Body, Controller, ForbiddenException, Get, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { CompanyBrandingService } from './company-branding.service';
import { PatchCompanyBrandingDto } from './dto/patch-company-branding.dto';

@ApiTags('company-branding')
@Controller('company/branding')
export class AdminBrandingController {
  constructor(private readonly service: CompanyBrandingService) {}

  @Roles(UserRole.ADMIN)
  @Permissions('company_branding:manage')
  @Get()
  async getBranding(@CurrentUser() user: AuthUser) {
    if (!user?.companyId) throw new ForbiddenException('No associated company');
    return this.service.getOwnBranding(user.companyId);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('company_branding:manage')
  @Patch()
  async patchBranding(
    @CurrentUser() user: AuthUser,
    @Body() dto: PatchCompanyBrandingDto,
  ) {
    if (!user?.companyId) throw new ForbiddenException('No associated company');
    return this.service.updateBranding(user.companyId, dto);
  }
}

/**
 * The company's currency for anyone signed in to it — every staff role, broker
 * users and customers. The dashboard and portal format all amounts with it;
 * /company/branding is ADMIN-only, so it cannot serve them.
 */
@ApiTags('company')
@Controller('company/currency')
export class CompanyCurrencyController {
  constructor(private readonly service: CompanyBrandingService) {}

  // Every role that belongs to a company (all but SUPER_ADMIN).
  @Roles(
    UserRole.ADMIN,
    UserRole.SALES,
    UserRole.SALES_MANAGER,
    UserRole.MAINTENANCE_SUPERVISOR,
    UserRole.BROKER,
    UserRole.CUSTOMER,
    UserRole.CLIENT,
  )
  @Get()
  async getCurrency(@CurrentUser() user: AuthUser) {
    if (!user?.companyId) throw new ForbiddenException('No associated company');
    return { currency: await this.service.getCurrency(user.companyId) };
  }
}
