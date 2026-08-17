import {
  Body, Controller, Get, Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { BypassTenant } from '../../common/decorators/bypass-tenant.decorator';
import { SuperAdminService } from './super-admin.service';
import type {
  CreateCompanyDto,
  UpdateCompanyDto,
  CancelCompanyDto,
  CreateCompanyAdminDto,
} from './dto/super-admin.dto';

@Controller('super-admin')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@BypassTenant()
export class SuperAdminController {
  constructor(private readonly service: SuperAdminService) {}

  @Get('companies')
  listCompanies() {
    return this.service.listCompanies();
  }

  @Get('companies/:id')
  getCompany(@Param('id') id: string) {
    return this.service.getCompany(id);
  }

  @Post('companies')
  createCompany(@Body() dto: CreateCompanyDto) {
    return this.service.createCompany(dto);
  }

  @Patch('companies/:id')
  updateCompany(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.service.updateCompany(id, dto);
  }

  @Post('companies/:id/cancel')
  cancelCompany(@Param('id') id: string, @Body() dto: CancelCompanyDto) {
    return this.service.cancelCompany(id, dto);
  }

  @Post('companies/:id/suspend')
  suspendCompany(@Param('id') id: string, @Body() body: { reason?: string }) {
    return this.service.suspendCompany(id, body.reason);
  }

  @Post('companies/:id/activate')
  activateCompany(@Param('id') id: string) {
    return this.service.activateCompany(id);
  }

  @Post('companies/:id/admin')
  createCompanyAdmin(@Param('id') id: string, @Body() dto: CreateCompanyAdminDto) {
    return this.service.createCompanyAdmin(id, dto);
  }
}
