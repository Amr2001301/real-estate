import { Body, Controller, Delete, Get, Module, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { BypassTenant } from '../../common/decorators/bypass-tenant.decorator';
import { MediaModule } from '../media/media.module';
import { MobileAppsService } from './mobile-apps.service';
import { PresignMobileAppAssetDto, PutCompanyMobileAppDto } from './mobile-apps.dto';

/** The platform owner: each company's own customer app in the stores. */
@Controller('super-admin')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@BypassTenant()
export class MobileAppsAdminController {
  constructor(private readonly apps: MobileAppsService) {}

  @Get('companies/:companyId/mobile-app')
  get(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.apps.get(companyId);
  }

  @Put('companies/:companyId/mobile-app')
  put(@Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: PutCompanyMobileAppDto) {
    return this.apps.put(companyId, dto);
  }

  @Delete('companies/:companyId/mobile-app')
  remove(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.apps.remove(companyId);
  }

  /** An upload URL for the app icon or splash image (PNG). */
  @Post('mobile-app/presign')
  presign(@Body() dto: PresignMobileAppAssetDto) {
    return this.apps.presign(dto);
  }
}

@Module({
  imports: [MediaModule],
  controllers: [MobileAppsAdminController],
  providers: [MobileAppsService],
})
export class MobileAppsModule {}
