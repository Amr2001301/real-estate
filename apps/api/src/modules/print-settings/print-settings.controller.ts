import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import {
  CreateDocumentTemplateDto,
  PatchPrintSettingsDto,
  PRINT_ASSETS,
  TemplatesQueryDto,
  UpdateDocumentTemplateDto,
  type PrintAsset,
} from './dto/print-settings.dto';
import { PRINT_ASSET_MAX_BYTES, PrintSettingsService, type UploadedPrintAsset } from './print-settings.service';

const ASSET_ENUM = Object.fromEntries(PRINT_ASSETS.map((a) => [a, a])) as Record<PrintAsset, PrintAsset>;

/**
 * The company's print settings (P4). Editing is the admin's, under the
 * company-branding permission; reading — the signature and stamp included —
 * is for the staff who print from the dashboard. Customers and brokers never
 * receive the signature or stamp images.
 */
@ApiTags('print-settings')
@Controller('company/print-settings')
export class PrintSettingsController {
  constructor(private readonly service: PrintSettingsService) {}

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES)
  @Get()
  get() {
    return this.service.get();
  }

  @Roles(UserRole.ADMIN)
  @Permissions('company_branding:manage')
  @Patch()
  update(@Body() dto: PatchPrintSettingsDto) {
    return this.service.update(dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('company_branding:manage')
  @Put(':asset')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: PRINT_ASSET_MAX_BYTES } }))
  setAsset(
    @Param('asset', new ParseEnumPipe(ASSET_ENUM)) asset: PrintAsset,
    @UploadedFile() file: UploadedPrintAsset | undefined,
  ) {
    return this.service.setAsset(asset, file);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('company_branding:manage')
  @Delete(':asset')
  clearAsset(@Param('asset', new ParseEnumPipe(ASSET_ENUM)) asset: PrintAsset) {
    return this.service.clearAsset(asset);
  }
}

/** The wording of the company's contracts and booking forms. */
@ApiTags('print-settings')
@Controller('document-templates')
export class DocumentTemplatesController {
  constructor(private readonly service: PrintSettingsService) {}

  // The print pages choose from them, so the staff who print read them.
  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES)
  @Get()
  list(@Query() q: TemplatesQueryDto) {
    return this.service.listTemplates(q.documentType);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES)
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getTemplate(id);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('company_branding:manage')
  @Post()
  create(@Body() dto: CreateDocumentTemplateDto) {
    return this.service.createTemplate(dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('company_branding:manage')
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDocumentTemplateDto) {
    return this.service.updateTemplate(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('company_branding:manage')
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteTemplate(id);
  }
}
