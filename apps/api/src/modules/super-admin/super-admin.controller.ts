import {
  Body, Controller, Delete, Get, Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { BypassTenant } from '../../common/decorators/bypass-tenant.decorator';
import { SuperAdminService } from './super-admin.service';
import {
  CreateCompanyDto,
  UpdateCompanyDto,
  UpdateCapabilitiesDto,
  CancelCompanyDto,
  SuspendCompanyDto,
  CreateCompanyAdminDto,
  CreatePricingPackageDto,
  UpdatePricingPackageDto,
  UpdateCompanyModulesDto,
} from './dto/super-admin.dto';

@Controller('super-admin')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@BypassTenant()
export class SuperAdminController {
  constructor(private readonly service: SuperAdminService) {}

  // ── Companies ──────────────────────────────────────────────────────────────

  @Get('companies')
  listCompanies() { return this.service.listCompanies(); }

  @Get('companies/:id')
  getCompany(@Param('id') id: string) { return this.service.getCompany(id); }

  @Post('companies')
  createCompany(@Body() dto: CreateCompanyDto) { return this.service.createCompany(dto); }

  @Patch('companies/:id')
  updateCompany(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.service.updateCompany(id, dto);
  }

  @Post('companies/:id/cancel')
  cancelCompany(@Param('id') id: string, @Body() dto: CancelCompanyDto) {
    return this.service.cancelCompany(id, dto);
  }

  @Post('companies/:id/suspend')
  suspendCompany(@Param('id') id: string, @Body() dto: SuspendCompanyDto) {
    return this.service.suspendCompany(id, dto.reason);
  }

  @Post('companies/:id/activate')
  activateCompany(@Param('id') id: string) { return this.service.activateCompany(id); }

  // MT-041: Hard delete blocked — lifecycle archival is the intended path
  @Delete('companies/:id')
  deleteCompany(@Param('id') id: string) { return this.service.deleteCompany(id); }

  // MT-042: Dedicated capability update endpoint; invalidates Redis cache
  @Patch('companies/:id/capabilities')
  updateCapabilities(@Param('id') id: string, @Body() dto: UpdateCapabilitiesDto) {
    return this.service.updateCapabilities(id, dto);
  }

  @Post('companies/:id/admin')
  createCompanyAdmin(@Param('id') id: string, @Body() dto: CreateCompanyAdminDto) {
    return this.service.createCompanyAdmin(id, dto);
  }

  // ── Global Pricing Packages ────────────────────────────────────────────────

  @Get('pricing')
  listPricing() { return this.service.listPricingPackages(); }

  @Post('pricing')
  createPricing(@Body() dto: CreatePricingPackageDto) {
    return this.service.createPricingPackage(dto);
  }

  @Patch('pricing/:id')
  updatePricing(@Param('id') id: string, @Body() dto: UpdatePricingPackageDto) {
    return this.service.updatePricingPackage(id, dto);
  }

  @Delete('pricing/:id')
  deletePricing(@Param('id') id: string) { return this.service.deletePricingPackage(id); }

  // ── Company-specific Pricing ───────────────────────────────────────────────

  @Get('companies/:id/pricing')
  getCompanyPricing(@Param('id') id: string) {
    return this.service.listPricingPackages(id);
  }

  @Post('companies/:id/pricing')
  createCompanyPricing(@Param('id') id: string, @Body() dto: CreatePricingPackageDto) {
    return this.service.createPricingPackage(dto, id);
  }

  @Patch('companies/:id/pricing/:pkgId')
  updateCompanyPricing(
    @Param('id') _id: string,
    @Param('pkgId') pkgId: string,
    @Body() dto: UpdatePricingPackageDto,
  ) { return this.service.updatePricingPackage(pkgId, dto); }

  @Delete('companies/:id/pricing/:pkgId')
  deleteCompanyPricing(@Param('pkgId') pkgId: string) {
    return this.service.deletePricingPackage(pkgId);
  }

  // ── Company Modules ────────────────────────────────────────────────────────

  @Get('companies/:id/modules')
  getModules(@Param('id') id: string) { return this.service.getCompanyModules(id); }

  @Patch('companies/:id/modules')
  updateModules(@Param('id') id: string, @Body() dto: UpdateCompanyModulesDto) {
    return this.service.updateCompanyModules(id, dto);
  }
}
