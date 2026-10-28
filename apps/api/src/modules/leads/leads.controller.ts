import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
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
import { parseEnumList, parseIsoInstant } from '../../common/utils/query-filters';
import { LeadScopeGuard } from './guards/lead-scope.guard';
import { LeadsService } from './leads.service';
import {
  AssignLeadDto,
  CreateLeadDto,
  CreateLeadNoteDto,
  CreateLeadSourceDto,
  UpdateLeadDto,
  UpdateLeadSourceDto,
  UpdateLeadStageDto,
  FOLLOW_UP_BUCKETS,
  FollowUpBucket,
  CreateLostReasonDto,
  UpdateLostReasonDto,
  OpenLeadContactDto,
  MergeLeadsDto,
} from './dto/lead.dto';
import { LeadDuplicatesService } from './lead-duplicates.service';
import { LeadCalendarService } from './lead-calendar.service';

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
    private readonly duplicatesSvc: LeadDuplicatesService,
    private readonly calendarSvc: LeadCalendarService,
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

  @Roles(UserRole.ADMIN)
  @Permissions('lead_sources:manage')
  @Patch('lead-sources/:id')
  updateSource(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLeadSourceDto) {
    return this.leads.updateSource(id, dto);
  }

  // Lost reasons: everyone picks from the active ones; the admin keeps the list.
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('leads:read')
  @Get('lost-reasons')
  listLostReasons(@CurrentUser() user: AuthUser, @Query('all') all?: string) {
    return this.leads.listLostReasons(all === '1' && user.role === UserRole.ADMIN);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('lead_sources:manage')
  @Post('lost-reasons')
  createLostReason(@Body() dto: CreateLostReasonDto) {
    return this.leads.createLostReason(dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('lead_sources:manage')
  @Patch('lost-reasons/:id')
  updateLostReason(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLostReasonDto) {
    return this.leads.updateLostReason(id, dto);
  }

  // Why leads were lost — the admin sees everyone, a sales manager their team.
  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER)
  @Permissions('leads:read')
  @Get('leads/lost-report')
  async lostReport(
    @CurrentUser() user: AuthUser,
    @Query('salesId') salesId?: string,
    @Query('projectId') projectId?: string,
    @Query('sourceId') sourceId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const scope = await resolveSalesScope(this.prisma, user, salesId);
    const day = (v: string | undefined, name: string) => {
      if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new BadRequestException(`${name} must be a date (YYYY-MM-DD)`);
      return v || undefined;
    };
    return this.leads.lostReport(scope, {
      from: day(from, 'from'),
      to: day(to, 'to'),
      projectId: projectId || undefined,
      sourceId: sourceId || undefined,
    });
  }

  // Pipeline counts
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('leads:read')
  @Get('leads/pipeline')
  async pipeline(@CurrentUser() user: AuthUser) {
    const scope = await resolveSalesScope(this.prisma, user);
    return this.leads.pipelineCounts(scope);
  }

  // Follow-ups: the leads whose next action is overdue, due today or later,
  // in the caller's sales scope (a rep sees their own, a manager their team).
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('leads:read')
  @Get('leads/follow-ups/summary')
  async followUpSummary(@CurrentUser() user: AuthUser, @Query('salesId') salesId?: string) {
    const scope = await resolveSalesScope(this.prisma, user, salesId);
    return this.leads.followUpSummary(scope);
  }

  // CAL1 — visits, follow-ups and logged calls between two company days
  // (YYYY-MM-DD), in the caller's scope: a rep their own, a manager their
  // team (or one member), the admin everyone (or one rep).
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('leads:read')
  @Get('leads/calendar')
  async calendar(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('salesId') salesId?: string,
  ) {
    const day = /^\d{4}-\d{2}-\d{2}$/;
    if (!from || !to || !day.test(from) || !day.test(to)) throw new BadRequestException('from and to must be dates (YYYY-MM-DD)');
    return this.calendarSvc.events(await resolveSalesScope(this.prisma, user, salesId || undefined), from, to);
  }

  // DUP1 — the same customer with more than one open lead: the admin sees
  // all, a sales manager their team's (and the unassigned queue).
  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER)
  @Permissions('leads:read')
  @Get('leads/duplicates')
  async duplicates(@CurrentUser() user: AuthUser) {
    return this.duplicatesSvc.list(await this.duplicateScope(user));
  }

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER)
  @Permissions('leads:update')
  @HttpCode(200)
  @Post('leads/:id/merge')
  async merge(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MergeLeadsDto, @CurrentUser() user: AuthUser) {
    return this.duplicatesSvc.merge(id, dto.duplicateIds, await this.duplicateScope(user), user.sub);
  }

  private async duplicateScope(user: AuthUser) {
    const scope = await resolveSalesScope(this.prisma, user);
    return { salesIds: scope.salesIds ?? (scope.salesId ? [scope.salesId] : undefined) };
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('leads:read')
  @Get('leads/follow-ups')
  async followUps(
    @CurrentUser() user: AuthUser,
    @Query('bucket') bucket = 'overdue',
    @Query('salesId') salesId?: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    if (!(FOLLOW_UP_BUCKETS as readonly string[]).includes(bucket)) {
      throw new BadRequestException(`bucket must be one of ${FOLLOW_UP_BUCKETS.join(', ')}`);
    }
    const scope = await resolveSalesScope(this.prisma, user, salesId);
    return this.leads.followUps(scope, bucket as FollowUpBucket, {
      page: Math.max(1, Number(page) || 1),
      pageSize: Math.max(1, Number(pageSize) || 20),
    });
  }

  // Leads
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('leads:read')
  @Get('leads')
  async list(
    @CurrentUser() user: AuthUser,
    // One stage or a comma-separated list, e.g. `NEW,INTERESTED`.
    @Query('stage') stage?: string,
    @Query('salesId') salesId?: string,
    @Query('q') q?: string,
    @Query('mine') mine?: string,
    @Query('clientId') clientId?: string,
    @Query('sourceId') sourceId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('createdBefore') createdBefore?: string,
    @Query('unassigned') unassigned?: string,
    @Query('lostReasonId') lostReasonId?: string,
    @Query('campaignId') campaignId?: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    const assignedToMe = mine === '1' && user.role === UserRole.SALES ? user.sub : undefined;
    // The queue of leads nobody owns yet (website, imports): admins and sales
    // managers see it and route it; a sales rep only ever sees their own.
    const unassignedQueue =
      unassigned === '1' && (user.role === UserRole.ADMIN || user.role === UserRole.SALES_MANAGER);
    const scope = unassignedQueue ? {} : await resolveSalesScope(this.prisma, user, salesId);
    return this.leads.findAll({
      page: Number(page),
      pageSize: Number(pageSize),
      stage: parseEnumList(stage, LeadStage, 'stage'),
      ...scope,
      q,
      assignedToMe,
      clientId,
      sourceId,
      dateFrom,
      dateTo,
      createdBefore: parseIsoInstant(createdBefore, 'createdBefore'),
      unassigned: unassignedQueue,
      lostReasonId: lostReasonId || undefined,
      campaignId: campaignId || undefined,
    });
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('leads:read')
  @UseInterceptors(LeadScopeGuard)
  @Get('leads/:id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return this.leads.findOne(id);
  }

  // The phone for a call / WhatsApp button, handed over when pressed and
  // logged on the lead (who, which) — the number is not kept on the screen.
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('leads:read')
  @UseInterceptors(LeadScopeGuard)
  @HttpCode(200)
  @Post('leads/:id/contact')
  openContact(@Param('id', ParseUUIDPipe) id: string, @Body() dto: OpenLeadContactDto, @CurrentUser() user: AuthUser) {
    return this.leads.openContact(id, dto.kind, user.sub);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('leads:create')
  @Post('leads')
  create(@Body() dto: CreateLeadDto, @CurrentUser() user: AuthUser) {
    return this.leads.create(dto, user);
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
    @CurrentUser() user: AuthUser,
    @Query('sourceId') sourceId?: string,
  ) {
    assertExcelFile(file);
    return this.leads.importLeads(file.buffer, sourceId, user);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('leads:update')
  @UseInterceptors(LeadScopeGuard)
  @Patch('leads/:id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.leads.update(id, dto, user.sub);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('leads:advance-stage')
  @UseInterceptors(LeadScopeGuard)
  @Patch('leads/:id/stage')
  async updateStage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadStageDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.leads.updateStage(id, dto, user.sub);
  }

  // Admins assign anywhere; a sales manager routes the unassigned queue and
  // their own team's leads within the team (checked in the service).
  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER)
  @Permissions('leads:assign')
  @Patch('leads/:id/assign')
  assign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignLeadDto, @CurrentUser() user: AuthUser) {
    return this.leads.assign(id, dto, user);
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
