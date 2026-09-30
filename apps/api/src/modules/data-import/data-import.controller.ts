import {
  BadRequestException,
  Controller,
  ForbiddenException,
  HttpCode,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { DataImportService } from './data-import.service';

/** Minimal multer file shape — avoids a hard @types/multer dependency. */
interface UploadedXlsx {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

@ApiTags('data-import')
@Controller('data-import')
export class DataImportController {
  constructor(private readonly service: DataImportService) {}

  /**
   * Preview an import file: parse and validate without writing to the database.
   * Returns the import plan with per-sheet row counts and any errors.
   * ADMIN only. companyId is derived from the authenticated session.
   */
  @Roles(UserRole.ADMIN)
  @Post('preview')
  @HttpCode(200)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file'))
  async preview(
    @UploadedFile() file: UploadedXlsx,
    @CurrentUser() user: AuthUser,
  ) {
    if (!user.companyId) throw new ForbiddenException('No company context on this account');
    if (!file?.buffer) throw new BadRequestException('No file uploaded');
    if (!file.originalname.toLowerCase().endsWith('.xlsx')) {
      throw new BadRequestException('Only .xlsx files are accepted');
    }

    const plan = await this.service.parseAndValidate(file.buffer, user.companyId);

    return {
      hasErrors: plan.hasErrors,
      crossTenantPhoneConflicts: plan.crossTenantPhoneConflicts,
      unresolvedLeadSalesReps: plan.unresolvedLeadSalesReps,
      projects:  summariseSheet(plan.projects),
      phases:    summariseSheet(plan.phases),
      buildings: summariseSheet(plan.buildings),
      units:     summariseSheet(plan.units),
      customers: summariseSheet(plan.customers),
      leads:     summariseSheet(plan.leads),
    };
  }

  /**
   * Apply an import file: parse, validate, and write to the database.
   * Aborts and returns 422 if the file has any parse/validation errors.
   * ADMIN only. companyId is derived from the authenticated session.
   */
  @Roles(UserRole.ADMIN)
  @Post('import')
  @HttpCode(200)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file'))
  async importData(
    @UploadedFile() file: UploadedXlsx,
    @CurrentUser() user: AuthUser,
  ) {
    if (!user.companyId) throw new ForbiddenException('No company context on this account');
    if (!file?.buffer) throw new BadRequestException('No file uploaded');
    if (!file.originalname.toLowerCase().endsWith('.xlsx')) {
      throw new BadRequestException('Only .xlsx files are accepted');
    }

    const plan = await this.service.parseAndValidate(file.buffer, user.companyId);

    if (plan.hasErrors) {
      return {
        success: false,
        hasErrors: true,
        crossTenantPhoneConflicts: plan.crossTenantPhoneConflicts,
        unresolvedLeadSalesReps: plan.unresolvedLeadSalesReps,
        projects:  summariseSheet(plan.projects),
        phases:    summariseSheet(plan.phases),
        buildings: summariseSheet(plan.buildings),
        units:     summariseSheet(plan.units),
        customers: summariseSheet(plan.customers),
        leads:     summariseSheet(plan.leads),
      };
    }

    const result = await this.service.applyPlan(plan, user.sub);

    return {
      success: true,
      hasErrors: false,
      ...result,
    };
  }
}

function summariseSheet(sheet: { sheetName: string; ops: Array<{ op: string }>; errors: unknown[]; warnings: unknown[]; errorCount: number }) {
  const counts = { create: 0, update: 0, unchanged: 0, locked: 0 };
  for (const op of sheet.ops) {
    if (op.op === 'create') counts.create++;
    else if (op.op === 'update') counts.update++;
    else if (op.op === 'locked') counts.locked++;
    else counts.unchanged++;
  }
  return {
    sheetName: sheet.sheetName,
    toCreate: counts.create,
    toUpdate: counts.update,
    unchanged: counts.unchanged,
    locked: counts.locked,
    errorCount: sheet.errorCount,
    errors: sheet.errors,
    warnings: sheet.warnings,
  };
}
