import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  Controller,
  ExceptionFilter,
  ForbiddenException,
  HttpCode,
  PayloadTooLargeException,
  Post,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { DataImportService } from './data-import.service';
import { nativeMemoryStorage } from '../../common/utils/multer-native-memory';

/** Minimal multer file shape — avoids a hard @types/multer dependency. */
interface UploadedXlsx {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

// 10 MB ceiling for import files.
// Rationale: the benchmark measured 540 KB for 13,703 rows. A realistic maximum
// (2,000 rows × 6 sheets) is ~473 KB. 10 MB is ~20× that, giving ample headroom
// for unusually dense files while still protecting the server from unbounded
// in-memory buffering of malicious or accidental uploads.
const IMPORT_MAX_BYTES = 10 * 1024 * 1024;

// Converts multer's PayloadTooLargeException to a bilingual message so Arabic-
// speaking admins see a readable explanation rather than the default English text.
@Catch(PayloadTooLargeException)
class ImportFileTooLargeFilter implements ExceptionFilter {
  catch(_exception: PayloadTooLargeException, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    res.status(413).json({
      statusCode: 413,
      message: `حجم الملف يتجاوز الحد المسموح به (${IMPORT_MAX_BYTES / 1024 / 1024} ميغابايت) — File exceeds the ${IMPORT_MAX_BYTES / 1024 / 1024} MB import limit`,
      error: 'Payload Too Large',
    });
  }
}

@ApiTags('data-import')
@Controller('data-import')
@UseFilters(ImportFileTooLargeFilter)
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
  @UseInterceptors(FileInterceptor('file', { storage: nativeMemoryStorage(), limits: { fileSize: IMPORT_MAX_BYTES } }))
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
  @UseInterceptors(FileInterceptor('file', { storage: nativeMemoryStorage(), limits: { fileSize: IMPORT_MAX_BYTES } }))
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
