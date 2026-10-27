import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { MigrationEntity } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { BypassTenant } from '../../common/decorators/bypass-tenant.decorator';
import { PlatformPublic } from '../../common/decorators/platform-public.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { runInCompany } from '../../common/tenant/tenant-context';
import { CreateMigrationRunDto, MigrationBatchDto } from './dto/data-migration.dto';
import { DataMigrationService, MIGRATION_ENTITY_BY_PATH, type MigrationPath } from './data-migration.service';

/**
 * Another system moving a company's data in, to the company's address
 * (`/v1/migration/:slug/...`) with the run's key in `X-Migration-Key`.
 * `?dryRun=true` checks a list and keeps nothing. The format is in
 * docs/DATA_MIGRATION_API.md.
 */
@ApiTags('data-migration')
@Controller('migration')
export class DataMigrationController {
  constructor(private readonly migration: DataMigrationService) {}

  @PlatformPublic()
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  @Get(':slug/status')
  async status(@Param('slug') slug: string, @Headers('x-migration-key') key: string | undefined) {
    const companyId = await this.migration.companyBySlug(slug);
    return runInCompany(companyId, async () => this.migration.status(await this.migration.runForKey(key, companyId)));
  }

  @PlatformPublic()
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  @HttpCode(200)
  @Post(':slug/:entity')
  async ingest(
    @Param('slug') slug: string,
    @Param('entity') entity: string,
    @Headers('x-migration-key') key: string | undefined,
    @Query('dryRun') dryRun: string | undefined,
    @Body() dto: MigrationBatchDto,
  ) {
    if (!(entity in MIGRATION_ENTITY_BY_PATH)) {
      throw new BadRequestException(`Unknown list "${entity}": one of ${Object.keys(MIGRATION_ENTITY_BY_PATH).join(', ')}`);
    }
    const companyId = await this.migration.companyBySlug(slug);
    return runInCompany(companyId, async () => {
      const run = await this.migration.runForKey(key, companyId);
      return this.migration.ingest(run, entity as MigrationPath, dto.items, dryRun === 'true' || dryRun === '1');
    });
  }
}

/** The platform owner: a company's migration runs, their keys and what came in. */
@ApiTags('data-migration')
@Controller('super-admin/companies/:companyId/migrations')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@BypassTenant()
export class DataMigrationAdminController {
  constructor(private readonly migration: DataMigrationService) {}

  @Get()
  list(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.migration.listRuns(companyId);
  }

  @Post()
  create(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateMigrationRunDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.migration.createRun(companyId, dto, user.sub);
  }

  @HttpCode(200)
  @Post(':runId/finish')
  finish(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('runId', ParseUUIDPipe) runId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.migration.finishRun(companyId, runId, user.sub);
  }

  @Get(':runId/records')
  records(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('runId', ParseUUIDPipe) runId: string,
    @Query('entity') entity?: string,
    @Query('kept') kept?: string,
  ) {
    const e = entity && (Object.values(MigrationEntity) as string[]).includes(entity) ? (entity as MigrationEntity) : undefined;
    const k = kept === 'extra' || kept === 'unmapped' ? kept : undefined;
    return this.migration.listRecords(companyId, runId, e, k);
  }
}
