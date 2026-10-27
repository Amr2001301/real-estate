/**
 * MT-049 — the company's website domain («دومين الموقع»).
 *
 * Connecting a domain is the platform owner's job (DNS records, hosting), so
 * adding, checking, setting primary and removing live under
 * /v1/super-admin/companies/:companyId/domains. The company's own admin only
 * reads its domains (/v1/company-domains), companyId taken from req.user.
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CompanyDomainsService } from './company-domains.service';
import { CreateCustomDomainDto } from './dto/company-domains.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { BypassTenant } from '../../common/decorators/bypass-tenant.decorator';

@ApiTags('company-domains')
@Controller('company-domains')
export class CompanyDomainsController {
  constructor(private readonly service: CompanyDomainsService) {}

  @Roles(UserRole.ADMIN)
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.companyId!);
  }
}

/** The platform owner connects and manages a company's website domain. */
@ApiTags('super-admin')
@Controller('super-admin/companies/:companyId/domains')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@BypassTenant()
export class CompanyDomainsAdminController {
  constructor(private readonly service: CompanyDomainsService) {}

  @Get()
  async list(@Param('companyId', ParseUUIDPipe) companyId: string) {
    await this.service.assertCompany(companyId);
    return this.service.list(companyId);
  }

  @Post()
  async create(@Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: CreateCustomDomainDto) {
    await this.service.assertCompany(companyId);
    return this.service.createCustom(companyId, dto.hostname);
  }

  @Delete(':id')
  remove(@Param('companyId', ParseUUIDPipe) companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.delete(companyId, id);
  }

  @Post(':id/verify')
  verify(@Param('companyId', ParseUUIDPipe) companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.verify(companyId, id);
  }

  @Post(':id/primary')
  setPrimary(@Param('companyId', ParseUUIDPipe) companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.setPrimary(companyId, id);
  }
}
