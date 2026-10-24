import { Body, Controller, Get, Module, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { BypassTenant } from '../../common/decorators/bypass-tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { getRequiredCompanyId } from '../../common/tenant/tenant-context';
import { NotificationsModule } from '../notifications/notifications.module';
import { AiPlansService } from './ai-plans.service';
import { AiPlansCron } from './ai-plans.cron';
import { AiPeriodDto, AiTopUpDto, CreateAiPackageDto, UpdateAiPackageDto } from './ai.dto';

/** The platform owner: AI packages and each company's assistant account. */
@Controller('super-admin/ai')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@BypassTenant()
export class AiAdminController {
  constructor(private readonly plans: AiPlansService) {}

  @Get('packages')
  listPackages() {
    return this.plans.listPackages();
  }

  @Post('packages')
  createPackage(@Body() dto: CreateAiPackageDto) {
    return this.plans.createPackage(dto);
  }

  @Patch('packages/:id')
  updatePackage(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAiPackageDto) {
    return this.plans.updatePackage(id, dto);
  }

  /** Companies near their limit, out of questions, or with a month ending/ended. */
  @Get('attention')
  attention() {
    return this.plans.attention();
  }

  @Get('companies/:companyId')
  account(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.plans.companyAccount(companyId);
  }

  @Post('companies/:companyId/activate')
  activate(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: AiPeriodDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.plans.startPeriod(companyId, dto, user.sub, 'ACTIVATE');
  }

  @Post('companies/:companyId/renew')
  renew(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: AiPeriodDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.plans.startPeriod(companyId, dto, user.sub, 'RENEW');
  }

  @Post('companies/:companyId/top-up')
  topUp(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: AiTopUpDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.plans.topUp(companyId, dto, user.sub);
  }
}

/** The company's admin: questions left this month and when it ends. */
@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiUsageController {
  constructor(private readonly plans: AiPlansService) {}

  @Roles(UserRole.ADMIN)
  @Get('usage')
  usage() {
    return this.plans.usage(getRequiredCompanyId());
  }
}

@Module({
  imports: [NotificationsModule],
  controllers: [AiAdminController, AiUsageController],
  providers: [AiPlansService, AiPlansCron],
  exports: [AiPlansService],
})
export class AiModule {}
