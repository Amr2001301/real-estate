import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { LeadStage, UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { resolveSalesScope } from '../../common/utils/sales-scope';
import { LeadScopeGuard } from './guards/lead-scope.guard';
import { LeadsService } from './leads.service';
import {
  AssignLeadDto,
  CreateLeadDto,
  CreateLeadNoteDto,
  CreateLeadSourceDto,
  UpdateLeadDto,
  UpdateLeadStageDto,
} from './dto/lead.dto';

const EXCEL_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

interface UploadedExcel {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

function assertExcelFile(file: UploadedExcel | undefined): void {
  if (!file) throw new BadRequestException('لم يتم رفع أي ملف');
  const allowed = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ];
  if (!allowed.includes(file.mimetype)) {
    throw new BadRequestException('يجب أن يكون الملف بصيغة Excel (.xlsx أو .xls)');
  }
}

@ApiTags('leads')
@Controller()
export class LeadsController {
  constructor(
    private readonly leads: LeadsService,
    private readonly prisma: PrismaService,
  ) {}

  // Sources
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('leads:read')
  @Get('lead-sources')
  listSources() {
    return this.leads.listSources();
  }

  @Roles(UserRole.ADMIN)
  @Permissions('lead_sources:manage')
  @Post('lead-sources')
  createSource(@Body() dto: CreateLeadSourceDto) {
    return this.leads.createSource(dto);
  }

  // Pipeline counts
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('leads:read')
  @Get('leads/pipeline')
  async pipeline(@CurrentUser() user: AuthUser) {
    const scope = await resolveSalesScope(this.prisma, user);
    return this.leads.pipelineCounts(scope);
  }

  // Leads
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('leads:read')
  @Get('leads')
  async list(
    @CurrentUser() user: AuthUser,
    @Query('stage') stage?: LeadStage,
    @Query('salesId') salesId?: string,
    @Query('q') q?: string,
    @Query('mine') mine?: string,
    @Query('clientId') clientId?: string,
    @Query('sourceId') sourceId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    const assignedToMe = mine === '1' && user.role === UserRole.SALES ? user.sub : undefined;
    const scope = await resolveSalesScope(this.prisma, user, salesId);
    return this.leads.findAll({
      page: Number(page),
      pageSize: Number(pageSize),
      stage,
      ...scope,
      q,
      assignedToMe,
      clientId,
      sourceId,
      dateFrom,
      dateTo,
    });
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('leads:read')
  @UseInterceptors(LeadScopeGuard)
  @Get('leads/:id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return this.leads.findOne(id);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('leads:create')
  @Post('leads')
  create(@Body() dto: CreateLeadDto) {
    return this.leads.create(dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER)
  @Permissions('leads:create')
  @Post('leads/import/preview')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: EXCEL_MAX_BYTES } }))
  async importPreview(@UploadedFile() file: UploadedExcel) {
    assertExcelFile(file);
    return this.leads.previewImport(file.buffer);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER)
  @Permissions('leads:create')
  @Post('leads/import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: EXCEL_MAX_BYTES } }))
  async import(
    @UploadedFile() file: UploadedExcel,
    @Query('sourceId') sourceId?: string,
  ) {
    assertExcelFile(file);
    return this.leads.importLeads(file.buffer, sourceId);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('leads:update')
  @UseInterceptors(LeadScopeGuard)
  @Patch('leads/:id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.leads.update(id, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('leads:advance-stage')
  @UseInterceptors(LeadScopeGuard)
  @Patch('leads/:id/stage')
  async updateStage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadStageDto,
  ) {
    return this.leads.updateStage(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('leads:assign')
  @Patch('leads/:id/assign')
  assign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignLeadDto) {
    return this.leads.assign(id, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('leads:note')
  @UseInterceptors(LeadScopeGuard)
  @Post('leads/:id/notes')
  async addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateLeadNoteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.leads.addNote(id, user.sub, dto);
  }
}
