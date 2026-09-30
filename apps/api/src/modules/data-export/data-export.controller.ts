import {
  Controller,
  ForbiddenException,
  Get,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { xlsxFilename } from '../../common/utils/xlsx';
import { DataExportService } from './data-export.service';

@ApiTags('data-export')
@Controller('data-export')
export class DataExportController {
  constructor(
    private readonly service: DataExportService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Full tenant data export — one workbook, one sheet per entity.
   * ADMIN only. companyId is derived from the authenticated session; it cannot
   * be supplied as a parameter. Every call is audit-logged.
   */
  @Roles(UserRole.ADMIN)
  @Get('export.xlsx')
  async exportTenantData(@CurrentUser() user: AuthUser): Promise<StreamableFile> {
    if (!user.companyId) {
      throw new ForbiddenException('No company context on this account');
    }

    const { buffer, sheetCounts, totalRows, companyName } =
      await this.service.generate(user.companyId, user.sub);

    await this.prisma.auditLog.create({
      data: {
        actorId: user.sub,
        action: 'DATA_EXPORT',
        entityType: 'data-export',
        entityId: user.companyId,
        after: { totalRows, sheets: sheetCounts } as object,
        companyId: user.companyId,
      },
    });

    const safeName = companyName.replace(/[^\w؀-ۿ.-]+/g, '_');
    const filename = xlsxFilename(`export-${safeName}`);

    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${filename}"`,
    });
  }
}
