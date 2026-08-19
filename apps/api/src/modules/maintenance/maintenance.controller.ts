import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { MaintenanceStatus, MaintenanceReviewStatus, UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { MaintenanceService, ATTACH_MAX_BYTES, UploadedFile } from './maintenance.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateRequestDto,
  AdminCreateRequestDto,
  AssignMaintenanceDto,
  MaintenanceStatusDto,
  ConfirmResolutionDto,
  MaintenanceDocPresignDto,
  MaintenanceDocDto,
} from './maintenance.dto';

@ApiTags('maintenance')
@Controller()
export class MaintenanceController {
  constructor(private readonly svc: MaintenanceService) {}

  // Categories — Admin manages; CUSTOMER reads when filing a request, so
  // the GET stays role-only (no @Permissions — gating it would lock
  // customers out, since they can't have admin permission rows assigned).
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER)
  @Get('maintenance-categories')
  listCategories() {
    return this.svc.listCategories();
  }

  @Roles(UserRole.ADMIN)
  @Permissions('maintenance:categories:manage')
  @Post('maintenance-categories')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.svc.createCategory(dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('maintenance:categories:manage')
  @Patch('maintenance-categories/:id')
  updateCategory(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCategoryDto) {
    return this.svc.updateCategory(id, dto);
  }

  // Customer self-service — intentionally NOT permission-gated. Accepts an
  // optional multipart `attachments` field (≤5 images/PDFs, ≤5 MB each) sent
  // alongside the text fields; each file is streamed to storage and logged as
  // a customer-visible Document on the new request.
  @Roles(UserRole.CUSTOMER)
  @Post('me/maintenance-requests')
  @UseInterceptors(FilesInterceptor('attachments', 5, { limits: { fileSize: ATTACH_MAX_BYTES } }))
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateRequestDto,
    @UploadedFiles() attachments?: UploadedFile[],
  ) {
    const created = await this.svc.createRequest(user.sub, dto);
    if (attachments?.length) {
      await this.svc.addCustomerAttachments(user.sub, created.id, attachments);
    }
    return created;
  }

  // Self-service list. CUSTOMER sees requests they filed; MAINTENANCE_SUPERVISOR
  // (mobile) sees requests assigned to them. Both are role-scoped to user.sub.
  @Roles(UserRole.CUSTOMER, UserRole.MAINTENANCE_SUPERVISOR)
  @Get('me/maintenance-requests')
  myList(
    @CurrentUser() user: AuthUser,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    if (user.role === UserRole.MAINTENANCE_SUPERVISOR) {
      return this.svc.supervisorList(user.sub, Number(page), Number(pageSize));
    }
    return this.svc.list({
      page: Number(page),
      pageSize: Number(pageSize),
      customerId: user.sub,
    });
  }

  // Self-service detail (404 for a request not in scope). CUSTOMER sees the
  // request they filed with their visible photos; MAINTENANCE_SUPERVISOR sees a
  // request assigned to them with all attached documents.
  @Roles(UserRole.MAINTENANCE_SUPERVISOR, UserRole.CUSTOMER)
  @Get('me/maintenance-requests/:id')
  myDetail(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return user.role === UserRole.CUSTOMER
      ? this.svc.customerFindOne(user.sub, id)
      : this.svc.supervisorFindOne(user.sub, id);
  }

  // Supervisor mobile status update — restricted transition subset.
  @Roles(UserRole.MAINTENANCE_SUPERVISOR)
  @Post('me/maintenance-requests/:id/status')
  myStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MaintenanceStatusDto,
  ) {
    return this.svc.supervisorSetStatus(user.sub, id, dto.status);
  }

  // ── Resolution loop (Phase A) ────────────────────────────────────────────

  // Customer confirms resolution + rating (one-time, after RESOLVED/CLOSED).
  @Roles(UserRole.CUSTOMER)
  @Post('me/maintenance-requests/:id/confirm-resolution')
  myConfirmResolution(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmResolutionDto,
  ) {
    return this.svc.customerConfirmResolution(user.sub, id, dto);
  }

  // Customer files a complaint (only ≥24h overdue, once).
  @Roles(UserRole.CUSTOMER)
  @Post('me/maintenance-requests/:id/complaint')
  myComplaint(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.customerComplaint(user.sub, id);
  }

  // Assigned supervisor explicitly confirms resolution (no rating; one-time).
  @Roles(UserRole.MAINTENANCE_SUPERVISOR)
  @Post('me/maintenance-requests/:id/supervisor-confirm')
  mySupervisorConfirm(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.supervisorConfirmResolution(user.sub, id);
  }

  // Scoped photo/document upload. Owner is forced to the in-scope request and
  // reuses the documents service (never the admin documents controller).
  // A MAINTENANCE_SUPERVISOR uploads to a request assigned to them (internal);
  // a CUSTOMER uploads to a request they filed (customer-visible).
  @Roles(UserRole.MAINTENANCE_SUPERVISOR, UserRole.CUSTOMER)
  @Post('me/maintenance-requests/:id/documents/presign')
  myPresign(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MaintenanceDocPresignDto,
  ) {
    return user.role === UserRole.CUSTOMER
      ? this.svc.customerPresign(user.sub, id, dto)
      : this.svc.supervisorPresign(user.sub, id, dto);
  }

  @Roles(UserRole.MAINTENANCE_SUPERVISOR, UserRole.CUSTOMER)
  @Post('me/maintenance-requests/:id/documents')
  myCreateDocument(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MaintenanceDocDto,
  ) {
    return user.role === UserRole.CUSTOMER
      ? this.svc.customerCreateDocument(user.sub, id, dto)
      : this.svc.supervisorCreateDocument(user.sub, id, dto);
  }

  // Admin create-on-behalf — uses the existing maintenance:create permission.
  @Roles(UserRole.ADMIN)
  @Permissions('maintenance:create')
  @Post('maintenance-requests')
  adminCreate(@Body() dto: AdminCreateRequestDto) {
    return this.svc.adminCreateRequest(dto);
  }

  // Units linked to a customer via contracts — powers the dependent
  // customer→unit picker on the admin create form. ADMIN-only, maintenance:read.
  @Roles(UserRole.ADMIN)
  @Permissions('maintenance:read')
  @Get('customers/:id/maintenance-units')
  customerUnits(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.customerUnits(id);
  }

  // Admin manages all
  @Roles(UserRole.ADMIN)
  @Permissions('maintenance:read')
  @Get('maintenance-requests')
  list(
    @Query('status') status?: MaintenanceStatus,
    @Query('customerId') customerId?: string,
    @Query('assignedAdminId') assignedAdminId?: string,
    @Query('reviewStatus') reviewStatus?: MaintenanceReviewStatus,
    @Query('categoryId') categoryId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    return this.svc.list({
      page: Number(page),
      pageSize: Number(pageSize),
      status,
      customerId,
      assignedAdminId,
      reviewStatus,
      categoryId,
      from,
      to,
    });
  }

  // Operational reporting summary. Declared before the `:id` route so the
  // literal "reports/summary" path is never read as a request id.
  @Roles(UserRole.ADMIN)
  @Permissions('maintenance:read')
  @Get('maintenance-requests/reports/summary')
  reportsSummary(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('assignedAdminId') assignedAdminId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('reviewStatus') reviewStatus?: MaintenanceReviewStatus,
    @Query('status') status?: MaintenanceStatus,
  ) {
    return this.svc.reportsSummary({ from, to, assignedAdminId, categoryId, reviewStatus, status });
  }

  // CSV export of the same report. Declared before `:id` so the literal path
  // is never read as a request id.
  @Roles(UserRole.ADMIN)
  @Permissions('maintenance:read')
  @Get('maintenance-requests/reports/summary.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="maintenance-report.csv"')
  reportsSummaryCsv(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('assignedAdminId') assignedAdminId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('reviewStatus') reviewStatus?: MaintenanceReviewStatus,
    @Query('status') status?: MaintenanceStatus,
  ) {
    return this.svc.reportsSummaryCsv({ from, to, assignedAdminId, categoryId, reviewStatus, status });
  }

  // P15.3 — styled XLSX twin (default UI download). Same ADMIN-only gate +
  // filters; the CSV above stays as the raw-data fallback. Declared before
  // `:id` so the literal path is never read as a request id.
  @Roles(UserRole.ADMIN)
  @Permissions('maintenance:read')
  @Get('maintenance-requests/reports/summary.xlsx')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header('Content-Disposition', 'attachment; filename="maintenance-report.xlsx"')
  async reportsSummaryXlsx(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('assignedAdminId') assignedAdminId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('reviewStatus') reviewStatus?: MaintenanceReviewStatus,
    @Query('status') status?: MaintenanceStatus,
  ): Promise<StreamableFile> {
    return new StreamableFile(
      await this.svc.reportsSummaryXlsx({ from, to, assignedAdminId, categoryId, reviewStatus, status }),
    );
  }

  @Roles(UserRole.ADMIN)
  @Permissions('maintenance:read')
  @Get('maintenance-requests/:id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(id);
  }

  // Assignment route — validates the assignee and auto-advances OPEN→ASSIGNED.
  @Roles(UserRole.ADMIN)
  @Permissions('maintenance:assign')
  @Post('maintenance-requests/:id/assign')
  assignRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignMaintenanceDto,
  ) {
    return this.svc.assign(id, dto.assignedAdminId);
  }

  // Status transition route — enforces the allowed transition graph.
  @Roles(UserRole.ADMIN)
  @Permissions('maintenance:resolve')
  @Post('maintenance-requests/:id/status')
  setRequestStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MaintenanceStatusDto,
  ) {
    return this.svc.setStatus(id, dto.status);
  }

  // Admin review gate — approve starts the SLA timer, reject closes the request
  // to field work. Both require a PENDING request. Reuses maintenance:resolve.
  @Roles(UserRole.ADMIN)
  @Permissions('maintenance:resolve')
  @Post('maintenance-requests/:id/approve')
  approveRequest(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.approve(id);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('maintenance:resolve')
  @Post('maintenance-requests/:id/reject')
  rejectRequest(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.reject(id);
  }
}
