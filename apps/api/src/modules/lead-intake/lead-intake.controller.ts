import { Body, Controller, Delete, Get, Headers, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PlatformPublic } from '../../common/decorators/platform-public.decorator';
import { runInCompany } from '../../common/tenant/tenant-context';
import { LeadIntakeService } from './lead-intake.service';
import { CreateIntakeKeyDto, IntakeLeadDto, RoutingSettingsDto, UpdateIntakeKeyDto } from './lead-intake.dto';

/**
 * Leads arriving on their own. A lead source (Zapier / Make with Facebook or
 * Instagram lead ads, Google or TikTok lead forms, any form tool) posts to
 * the company's address with one of its keys in `X-Intake-Key`.
 */
@ApiTags('lead-intake')
@Controller()
export class LeadIntakeController {
  constructor(private readonly intake: LeadIntakeService) {}

  @PlatformPublic()
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  @HttpCode(200)
  @Post('intake/:slug/leads')
  async receive(
    @Param('slug') slug: string,
    @Headers('x-intake-key') headerKey: string | undefined,
    @Query('key') queryKey: string | undefined,
    @Body() dto: IntakeLeadDto,
  ) {
    const companyId = await this.intake.companyBySlug(slug);
    return runInCompany(companyId, () => this.intake.intake(headerKey ?? queryKey, dto));
  }

  @Roles(UserRole.ADMIN)
  @Permissions('campaigns:manage')
  @Get('lead-intake/keys')
  list() {
    return this.intake.listKeys();
  }

  @Roles(UserRole.ADMIN)
  @Permissions('campaigns:manage')
  @Post('lead-intake/keys')
  create(@Body() dto: CreateIntakeKeyDto) {
    return this.intake.createKey(dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('campaigns:manage')
  @Patch('lead-intake/keys/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateIntakeKeyDto) {
    return this.intake.updateKey(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('campaigns:manage')
  @Post('lead-intake/keys/:id/rotate')
  rotate(@Param('id', ParseUUIDPipe) id: string) {
    return this.intake.rotateKey(id);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('campaigns:manage')
  @Delete('lead-intake/keys/:id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.intake.deleteKey(id);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER)
  @Permissions('leads:read')
  @Get('lead-intake/settings')
  settings() {
    return this.intake.getRouting();
  }

  @Roles(UserRole.ADMIN)
  @Permissions('campaigns:manage')
  @Put('lead-intake/settings')
  saveSettings(@Body() dto: RoutingSettingsDto) {
    return this.intake.saveRouting(dto);
  }
}
