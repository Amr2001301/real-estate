import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Injectable,
  Logger,
  Module,
  NotFoundException,
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
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  Prisma,
  MaintenanceStatus,
  MaintenancePriority,
  MaintenanceResolutionConfirmedBy,
  MaintenanceReviewStatus,
  WarrantyStatus,
  NotificationChannel,
  DocumentOwnerType,
  DocumentCategory,
  DocumentVisibility,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toCsv, type CsvCell } from '../../common/utils/csv';
import {
  addFooter,
  addTable,
  addTitledTable,
  createReportWorkbook,
  workbookToBuffer,
} from '../../common/utils/xlsx';
import { DocumentsModule, DocumentsService } from '../documents/documents.module';
import { MediaModule } from '../media/media.module';
import { R2Service } from '../media/r2.service';
import {
  NotificationsModule,
  NotificationsService,
} from '../notifications/notifications.module';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { paginate, takeSkip } from '../../common/utils/pagination';

enum SlaUnit {
  HOURS = 'HOURS',
  DAYS = 'DAYS',
}

enum WarrantyUnit {
  MONTHS = 'MONTHS',
  YEARS = 'YEARS',
}

// Max sane SLA = 365 days, expressed in minutes, to reject nonsense values.
const MAX_SLA_MINUTES = 365 * 24 * 60;
// Max sane warranty = 100 years, in months.
const MAX_WARRANTY_MONTHS = 100 * 12;

const PRIORITY_RANK: Record<MaintenancePriority, number> = {
  [MaintenancePriority.LOW]: 1,
  [MaintenancePriority.MEDIUM]: 2,
  [MaintenancePriority.HIGH]: 3,
  [MaintenancePriority.URGENT]: 4,
};

// Convert an admin-entered warranty (value + unit) into months; validates bounds.
function warrantyToMonths(value: number | undefined, unit: WarrantyUnit | undefined): number | null {
  if (value === undefined && unit === undefined) return null;
  if (value === undefined || unit === undefined) {
    throw new BadRequestException('warrantyValue and warrantyUnit must be provided together');
  }
  if (value <= 0) throw new BadRequestException('warrantyValue must be positive');
  const months = unit === WarrantyUnit.YEARS ? value * 12 : value;
  if (months > MAX_WARRANTY_MONTHS) {
    throw new BadRequestException('Warranty exceeds the maximum (100 years)');
  }
  return months;
}

// Display/snapshot warranty verdict from a warranty end date.
function warrantyStatusFromEnd(warrantyEnd: Date | null): WarrantyStatus {
  if (!warrantyEnd) return WarrantyStatus.UNKNOWN;
  return warrantyEnd.getTime() >= Date.now()
    ? WarrantyStatus.IN_WARRANTY
    : WarrantyStatus.OUT_OF_WARRANTY;
}

class CreateCategoryDto {
  @IsString() ar!: string;
  @IsString() en!: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsEnum(MaintenancePriority) priority?: MaintenancePriority;
  @IsOptional() @IsInt() @Min(1) slaValue?: number;
  @IsOptional() @IsEnum(SlaUnit) slaUnit?: SlaUnit;
  @IsOptional() @IsInt() @Min(1) warrantyValue?: number;
  @IsOptional() @IsEnum(WarrantyUnit) warrantyUnit?: WarrantyUnit;
}

class UpdateCategoryDto {
  @IsOptional() @IsString() ar?: string;
  @IsOptional() @IsString() en?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsEnum(MaintenancePriority) priority?: MaintenancePriority;
  @IsOptional() @IsInt() @Min(1) slaValue?: number;
  @IsOptional() @IsEnum(SlaUnit) slaUnit?: SlaUnit;
  @IsOptional() @IsInt() @Min(1) warrantyValue?: number;
  @IsOptional() @IsEnum(WarrantyUnit) warrantyUnit?: WarrantyUnit;
}

// Normalize a category name into a duplicate-prevention slug. Prefers the EN
// name; falls back to AR. Lowercased, alphanumerics/Arabic kept, spaces → "-".
function categoryCode(ar: string, en: string): string {
  const base = (en || ar || '').trim().toLowerCase();
  return base
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

// Convert an admin-entered SLA (value + unit) into minutes; validates bounds.
function slaToMinutes(value: number | undefined, unit: SlaUnit | undefined): number | null {
  if (value === undefined && unit === undefined) return null;
  if (value === undefined || unit === undefined) {
    throw new BadRequestException('slaValue and slaUnit must be provided together');
  }
  if (value <= 0) throw new BadRequestException('slaValue must be positive');
  const minutes = unit === SlaUnit.DAYS ? value * 24 * 60 : value * 60;
  if (minutes > MAX_SLA_MINUTES) {
    throw new BadRequestException('SLA exceeds the maximum (365 days)');
  }
  return minutes;
}

class CreateRequestDto {
  @IsUUID() unitId!: string;
  // Single category (back-compat) or multiple categories (new multi-item flow);
  // at least one must resolve.
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) categoryIds?: string[];
  @IsString() @MinLength(5) description!: string;
}

// Admin create-on-behalf (uses the existing maintenance:create permission).
class AdminCreateRequestDto {
  @IsUUID() customerId!: string;
  @IsUUID() unitId!: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) categoryIds?: string[];
  @IsString() @MinLength(5) description!: string;
  @IsOptional() @IsUUID() assignedAdminId?: string;
}

class AssignMaintenanceDto {
  @IsUUID() assignedAdminId!: string;
}

class MaintenanceStatusDto {
  @IsEnum(MaintenanceStatus) status!: MaintenanceStatus;
}

// Customer confirms a resolved request with a required 1–5 rating + optional note.
class ConfirmResolutionDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(5) rating!: number;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

// Scoped maintenance uploads (supervisor + customer) — presign + register.
// Owner is forced server-side to the in-scope MAINTENANCE_REQUEST, so these
// DTOs never carry ownerType/ownerId/category/visibility from the client.
class MaintenanceDocPresignDto {
  @IsString() @MaxLength(120) contentType!: string;
  @Type(() => Number) @IsInt() @Min(1) sizeBytes!: number;
  @IsOptional() @IsString() @MaxLength(255) fileName?: string;
}

class MaintenanceDocDto {
  @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsString() @MaxLength(2048) fileUrl!: string;
  @IsOptional() @IsString() @MaxLength(255) fileName?: string;
  @IsOptional() @IsString() @MaxLength(120) mimeType?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sizeBytes?: number;
}

/**
 * Allowed maintenance status transitions (strict v1). CLOSED is terminal.
 * Any source→target pair not listed here is rejected with 400. A no-op
 * (target === current) is treated as success and changes nothing.
 */
const STATUS_TRANSITIONS: Record<MaintenanceStatus, MaintenanceStatus[]> = {
  [MaintenanceStatus.OPEN]: [MaintenanceStatus.ASSIGNED, MaintenanceStatus.IN_PROGRESS],
  [MaintenanceStatus.ASSIGNED]: [MaintenanceStatus.IN_PROGRESS, MaintenanceStatus.OPEN],
  [MaintenanceStatus.IN_PROGRESS]: [MaintenanceStatus.RESOLVED, MaintenanceStatus.ASSIGNED],
  [MaintenanceStatus.RESOLVED]: [MaintenanceStatus.CLOSED, MaintenanceStatus.IN_PROGRESS],
  [MaintenanceStatus.CLOSED]: [],
};

/**
 * The narrower transition set a MAINTENANCE_SUPERVISOR may drive from the
 * mobile app — strictly a subset of STATUS_TRANSITIONS. Supervisors progress
 * field work but cannot OPEN→ASSIGN, CLOSE, or reopen a closed request; those
 * stay with admin staff.
 */
const SUPERVISOR_TRANSITIONS: Record<MaintenanceStatus, MaintenanceStatus[]> = {
  [MaintenanceStatus.OPEN]: [],
  [MaintenanceStatus.ASSIGNED]: [MaintenanceStatus.IN_PROGRESS],
  [MaintenanceStatus.IN_PROGRESS]: [MaintenanceStatus.RESOLVED],
  [MaintenanceStatus.RESOLVED]: [MaintenanceStatus.IN_PROGRESS],
  [MaintenanceStatus.CLOSED]: [],
};

// Arabic status labels for notification payloads.
const STATUS_LABEL_AR: Record<MaintenanceStatus, string> = {
  [MaintenanceStatus.OPEN]: 'مفتوح',
  [MaintenanceStatus.ASSIGNED]: 'مُسند',
  [MaintenanceStatus.IN_PROGRESS]: 'قيد التنفيذ',
  [MaintenanceStatus.RESOLVED]: 'تم الحل',
  [MaintenanceStatus.CLOSED]: 'مغلق',
};

// Resolution-loop windows (Phase A). A complaint is allowed once a request is
// this far past its dueAt; the cron flags it unresolved this long after the
// complaint. Both 24h per the desired flow.
const COMPLAINT_OVERDUE_MS = 24 * 60 * 60 * 1000;
const UNRESOLVED_AFTER_COMPLAINT_MS = 24 * 60 * 60 * 1000;

// Customer attachment limits (mirrored client-side). Images + PDF only.
const ATTACH_MAX_BYTES = 5 * 1024 * 1024;
const ATTACH_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

/** Minimal multer file shape — avoids a hard @types/multer dependency. */
interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
    private readonly notifications: NotificationsService,
    private readonly r2: R2Service,
  ) {}

  /**
   * Stream customer-uploaded attachments to object storage and log each as a
   * CUSTOMER_VISIBLE Document on the request — so they surface in the detail
   * view's "المرفقات". Validates type/size up-front (all-or-nothing).
   */
  async addCustomerAttachments(userId: string, requestId: string, files: UploadedFile[]) {
    await this.assertCustomerOwns(userId, requestId);
    for (const f of files) {
      if (!ATTACH_MIME[f.mimetype]) {
        throw new BadRequestException('Unsupported file type — only JPG, PNG, WEBP, or PDF are allowed');
      }
      if (f.size > ATTACH_MAX_BYTES) {
        throw new BadRequestException('File too large — max 5 MB per attachment');
      }
    }
    for (const f of files) {
      const ext = ATTACH_MIME[f.mimetype];
      const { publicUrl } = await this.r2.uploadObject({
        buffer: f.buffer,
        contentType: f.mimetype,
        folder: 'maintenance',
        extension: ext,
      });
      await this.documents.create(userId, {
        ownerType: DocumentOwnerType.MAINTENANCE_REQUEST,
        ownerId: requestId,
        category: f.mimetype === 'application/pdf' ? DocumentCategory.OTHER : DocumentCategory.IMAGE,
        title: (f.originalname || 'مرفق').slice(0, 200),
        fileUrl: publicUrl,
        fileName: f.originalname?.slice(0, 255),
        mimeType: f.mimetype,
        sizeBytes: f.size,
        visibility: DocumentVisibility.CUSTOMER_VISIBLE,
      });
    }
  }

  // ── Notifications (P4: routed through NotificationsService) ──
  // DB row is always created (helper swallows errors so the business action
  // never fails); push fires automatically when FCM is configured. The
  // previous direct prisma.notification.createMany helper is gone.

  // Notify staff (+ assignee) that a request was created. Best-effort.
  // ADMINs + MAINTENANCE_SUPERVISORs receive maintenance_request_created;
  // the specific assignee (if any) also receives the assigned event so they
  // know to pick it up.
  // Deep-link metadata every maintenance notification carries so the admin /
  // customer notification UIs can route to /dashboard/maintenance/[id] (or
  // /account/maintenance/[id]). entityType wins over the legacy requestId.
  private maintenanceLinkPayload(
    id: string,
    action: string,
    extra: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return { entityType: 'maintenance', entityId: id, requestId: id, action, ...extra };
  }

  private async notifyCreated(id: string, unitCode: string, assignedAdminId?: string | null) {
    const payload = this.maintenanceLinkPayload(id, 'view_maintenance_request', { unitCode });
    await this.notifications.sendToRoles(
      [UserRole.ADMIN, UserRole.MAINTENANCE_SUPERVISOR],
      'maintenance_request_created',
      payload,
    );
    if (assignedAdminId) {
      await this.notifications.sendToUser(
        assignedAdminId,
        'maintenance_request_assigned',
        payload,
      );
    }
  }

  // Notify assignee + customer that a request was assigned. Best-effort.
  private async notifyAssigned(id: string) {
    const r = await this.notifyContext(id);
    if (!r) return;
    const base = this.maintenanceLinkPayload(id, 'view_maintenance_request', { unitCode: r.unitCode });
    await this.notifications.sendToUser(r.assignedAdminId, 'maintenance_request_assigned', base);
    await this.notifications.sendToUser(
      r.customerId,
      'maintenance_request_status_changed',
      { ...base, statusLabel: STATUS_LABEL_AR[r.status] },
    );
  }

  // Notify customer (+ assignee) of a status change. Best-effort.
  private async notifyStatus(id: string) {
    const r = await this.notifyContext(id);
    if (!r) return;
    const code =
      r.status === MaintenanceStatus.RESOLVED
        ? 'maintenance_request_resolved'
        : r.status === MaintenanceStatus.CLOSED
          ? 'maintenance_request_closed'
          : 'maintenance_request_status_changed';
    const payload = this.maintenanceLinkPayload(id, 'view_maintenance_request', {
      unitCode: r.unitCode,
      statusLabel: STATUS_LABEL_AR[r.status],
    });
    await this.notifications.sendToUser(r.customerId, code, payload);
    if (r.assignedAdminId) {
      await this.notifications.sendToUser(
        r.assignedAdminId,
        'maintenance_request_status_changed',
        payload,
      );
    }
  }

  private async notifyContext(id: string) {
    const r = await this.prisma.maintenanceRequest.findUnique({
      where: { id },
      select: {
        customerId: true,
        assignedAdminId: true,
        status: true,
        unit: { select: { code: true } },
      },
    });
    if (!r) return null;
    return {
      customerId: r.customerId,
      assignedAdminId: r.assignedAdminId,
      status: r.status,
      unitCode: r.unit?.code ?? '',
    };
  }

  // Categories
  // Default to ACTIVE only (the picker UI wants live categories) and dedupe by
  // normalized code so legacy duplicate rows don't clutter the list. Pass
  // includeInactive=true for admin management views.
  async listCategories(includeInactive = false) {
    const rows = await this.prisma.maintenanceCategory.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: { createdAt: 'desc' },
    });
    if (includeInactive) return rows;
    // Collapse legacy duplicates: keep the first row per code (or per AR+EN name
    // when code is null), preserving createdAt-desc order.
    const seen = new Set<string>();
    return rows.filter((c) => {
      const name = (c.name ?? {}) as { ar?: string; en?: string };
      const key = c.code ?? categoryCode(name.ar ?? '', name.en ?? '');
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    const ar = dto.ar.trim();
    const en = dto.en.trim();
    const code = categoryCode(ar, en);
    if (!code) throw new BadRequestException('Category name is required');
    const existing = await this.prisma.maintenanceCategory.findUnique({ where: { code } });
    if (existing) {
      throw new BadRequestException('Category already exists');
    }
    return this.prisma.maintenanceCategory.create({
      data: {
        code,
        name: { ar, en } as Prisma.InputJsonValue,
        active: dto.active ?? true,
        priority: dto.priority ?? MaintenancePriority.MEDIUM,
        slaDurationMinutes: slaToMinutes(dto.slaValue, dto.slaUnit),
        warrantyDurationMonths: warrantyToMonths(dto.warrantyValue, dto.warrantyUnit),
      },
    });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const current = await this.prisma.maintenanceCategory.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Category not found');

    const data: Prisma.MaintenanceCategoryUpdateInput = {};
    if (dto.ar !== undefined || dto.en !== undefined) {
      const prev = (current.name ?? {}) as { ar?: string; en?: string };
      const ar = (dto.ar ?? prev.ar ?? '').trim();
      const en = (dto.en ?? prev.en ?? '').trim();
      const code = categoryCode(ar, en);
      // If the rename collides with a different category's code, reject.
      if (code && code !== current.code) {
        const clash = await this.prisma.maintenanceCategory.findUnique({ where: { code } });
        if (clash && clash.id !== id) throw new BadRequestException('Category already exists');
        data.code = code;
      }
      data.name = { ar, en } as Prisma.InputJsonValue;
    }
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.slaValue !== undefined || dto.slaUnit !== undefined) {
      data.slaDurationMinutes = slaToMinutes(dto.slaValue, dto.slaUnit);
    }
    if (dto.warrantyValue !== undefined || dto.warrantyUnit !== undefined) {
      data.warrantyDurationMonths = warrantyToMonths(dto.warrantyValue, dto.warrantyUnit);
    }
    return this.prisma.maintenanceCategory.update({ where: { id }, data });
  }

  // Units a customer owns through signed/recorded contracts. Used by the admin
  // maintenance-create picker so an admin can only file against units actually
  // linked to the chosen customer. Ownership source is Contract (not loose
  // reservations) for v1. Returns a deduped list; [] when the customer has none.
  async customerUnits(customerId: string) {
    const customer = await this.prisma.user.findUnique({
      where: { id: customerId },
      select: { id: true, role: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    if (customer.role !== UserRole.CUSTOMER) {
      throw new BadRequestException('User is not a customer');
    }
    const contracts = await this.prisma.contract.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      select: {
        unit: {
          select: {
            id: true,
            code: true,
            type: true,
            status: true,
            floor: true,
            building: { select: { id: true, name: true } },
          },
        },
      },
    });
    const seen = new Set<string>();
    const units: NonNullable<(typeof contracts)[number]['unit']>[] = [];
    for (const c of contracts) {
      if (!c.unit || seen.has(c.unit.id)) continue;
      seen.add(c.unit.id);
      units.push(c.unit);
    }
    return units;
  }

  // Requests

  // Resolve the request's categories from either categoryIds[] (multi) or the
  // legacy single categoryId. At least one is required; duplicates collapse.
  private resolveCategoryIds(dto: { categoryId?: string; categoryIds?: string[] }): string[] {
    const ids = dto.categoryIds?.length ? dto.categoryIds : dto.categoryId ? [dto.categoryId] : [];
    if (ids.length === 0) throw new BadRequestException('At least one category is required');
    return [...new Set(ids)];
  }

  // Build per-category snapshots for a request: priority + handling SLA from the
  // category, and the warranty verdict from the unit's matching active item (if
  // any). Returns the data needed both for the request row and its items.
  private async buildRequestItems(unitId: string, categoryIds: string[]) {
    const resolved: { id: string; priority: MaintenancePriority; slaDurationMinutes: number | null }[] = [];
    for (const id of categoryIds) {
      const c = await this.prisma.maintenanceCategory.findUnique({ where: { id } });
      if (!c) throw new NotFoundException('Category not found');
      resolved.push({ id: c.id, priority: c.priority, slaDurationMinutes: c.slaDurationMinutes });
    }
    const unitItems = await this.prisma.unitMaintenanceItem.findMany({
      where: { unitId, active: true, categoryId: { in: categoryIds } },
    });
    const itemByCat = new Map<string, (typeof unitItems)[number]>();
    for (const ui of unitItems) if (ui.categoryId) itemByCat.set(ui.categoryId, ui);

    const items = resolved.map((c) => {
      const ui = itemByCat.get(c.id) ?? null;
      const warrantyEnd = ui?.warrantyEnd ?? null;
      return {
        itemId: ui?.id ?? null,
        categoryId: c.id,
        categoryPrioritySnapshot: c.priority,
        handlingSlaMinutesSnapshot: c.slaDurationMinutes,
        warrantyStatusSnapshot: warrantyStatusFromEnd(warrantyEnd),
        warrantyEndSnapshot: warrantyEnd,
      };
    });
    const highestPriority = resolved.reduce<MaintenancePriority>(
      (acc, c) => (PRIORITY_RANK[c.priority] > PRIORITY_RANK[acc] ? c.priority : acc),
      MaintenancePriority.LOW,
    );
    const slaValues = resolved
      .map((c) => c.slaDurationMinutes)
      .filter((m): m is number => m != null);
    const maxSla = slaValues.length ? Math.max(...slaValues) : null;
    return { items, primaryCategoryId: resolved[0]!.id, highestPriority, maxSla };
  }

  private async createRequestItems(
    requestId: string,
    items: Array<{
      itemId: string | null;
      categoryId: string;
      categoryPrioritySnapshot: MaintenancePriority;
      handlingSlaMinutesSnapshot: number | null;
      warrantyStatusSnapshot: WarrantyStatus;
      warrantyEndSnapshot: Date | null;
    }>,
  ) {
    if (items.length === 0) return;
    await this.prisma.maintenanceRequestItem.createMany({
      data: items.map((i) => ({ requestId, ...i })),
    });
  }

  // Customer self-create. Starts PENDING review — the SLA timer (dueAt) does
  // NOT start until an admin approves.
  async createRequest(customerId: string, dto: CreateRequestDto) {
    const unit = await this.prisma.unit.findUnique({ where: { id: dto.unitId } });
    if (!unit) throw new NotFoundException('Unit not found');
    const categoryIds = this.resolveCategoryIds(dto);
    const { items, primaryCategoryId, highestPriority } = await this.buildRequestItems(
      dto.unitId,
      categoryIds,
    );

    const created = await this.prisma.maintenanceRequest.create({
      data: {
        customerId,
        unitId: dto.unitId,
        categoryId: primaryCategoryId,
        description: dto.description,
        priority: highestPriority,
        reviewStatus: MaintenanceReviewStatus.PENDING,
        // dueAt stays null until approval.
        // Primary item link kept for back-compat with single-item consumers.
        itemId: items[0]?.itemId ?? null,
        warrantyStatus: items[0]?.warrantyStatusSnapshot ?? null,
        warrantyEndSnapshot: items[0]?.warrantyEndSnapshot ?? null,
      },
    });
    await this.createRequestItems(created.id, items);
    await this.notifyCreated(created.id, unit.code);
    return created;
  }

  // Admin create-on-behalf. Starts APPROVED (admin is the reviewer), so the SLA
  // timer starts immediately: dueAt = now + max handling SLA across categories.
  // An optional assignee (active ADMIN/supervisor) starts the request ASSIGNED.
  async adminCreateRequest(dto: AdminCreateRequestDto) {
    const customer = await this.prisma.user.findUnique({
      where: { id: dto.customerId },
      select: { id: true, role: true },
    });
    if (!customer || customer.role !== UserRole.CUSTOMER) {
      throw new BadRequestException('customerId must reference a customer');
    }
    const unit = await this.prisma.unit.findUnique({ where: { id: dto.unitId } });
    if (!unit) throw new NotFoundException('Unit not found');
    const categoryIds = this.resolveCategoryIds(dto);
    const { items, primaryCategoryId, highestPriority, maxSla } = await this.buildRequestItems(
      dto.unitId,
      categoryIds,
    );

    let assignedAdminId: string | null = null;
    let status: MaintenanceStatus = MaintenanceStatus.OPEN;
    if (dto.assignedAdminId) {
      await this.assertAssignableAdmin(dto.assignedAdminId);
      assignedAdminId = dto.assignedAdminId;
      status = MaintenanceStatus.ASSIGNED;
    }

    const approvedAt = new Date();
    const created = await this.prisma.maintenanceRequest.create({
      data: {
        customerId: dto.customerId,
        unitId: dto.unitId,
        categoryId: primaryCategoryId,
        description: dto.description,
        assignedAdminId,
        status,
        priority: highestPriority,
        reviewStatus: MaintenanceReviewStatus.APPROVED,
        approvedAt,
        maxHandlingSlaMinutesSnapshot: maxSla,
        dueAt: maxSla != null ? new Date(approvedAt.getTime() + maxSla * 60_000) : null,
        itemId: items[0]?.itemId ?? null,
        warrantyStatus: items[0]?.warrantyStatusSnapshot ?? null,
        warrantyEndSnapshot: items[0]?.warrantyEndSnapshot ?? null,
      },
    });
    await this.createRequestItems(created.id, items);
    await this.notifyCreated(created.id, unit.code, assignedAdminId);
    return created;
  }

  // ── Admin review (approval gate) ──────────────────────────────────────────

  // Approve a pending request: start the SLA timer. dueAt = approvedAt + the max
  // handling SLA among the request's selected categories (null if none has one).
  async approve(id: string) {
    const req = await this.requireRequest(id);
    if (req.reviewStatus !== MaintenanceReviewStatus.PENDING) {
      throw new BadRequestException('Only a pending request can be approved');
    }
    const approvedAt = new Date();
    const reqItems = await this.prisma.maintenanceRequestItem.findMany({
      where: { requestId: id },
      select: { handlingSlaMinutesSnapshot: true },
    });
    const slaValues = reqItems
      .map((i) => i.handlingSlaMinutesSnapshot)
      .filter((m): m is number => m != null);
    const maxSla = slaValues.length ? Math.max(...slaValues) : null;
    const updated = await this.prisma.maintenanceRequest.update({
      where: { id },
      data: {
        reviewStatus: MaintenanceReviewStatus.APPROVED,
        approvedAt,
        rejectedAt: null,
        maxHandlingSlaMinutesSnapshot: maxSla,
        dueAt: maxSla != null ? new Date(approvedAt.getTime() + maxSla * 60_000) : null,
      },
    });
    await this.notifications.sendToUser(
      req.customerId,
      'maintenance_request_status_changed',
      { statusLabel: 'تمت الموافقة' },
    );
    return updated;
  }

  async reject(id: string) {
    const req = await this.requireRequest(id);
    if (req.reviewStatus !== MaintenanceReviewStatus.PENDING) {
      throw new BadRequestException('Only a pending request can be rejected');
    }
    const updated = await this.prisma.maintenanceRequest.update({
      where: { id },
      data: {
        reviewStatus: MaintenanceReviewStatus.REJECTED,
        rejectedAt: new Date(),
        dueAt: null,
      },
    });
    await this.notifications.sendToUser(
      req.customerId,
      'maintenance_request_status_changed',
      { statusLabel: 'مرفوض' },
    );
    return updated;
  }

  findOne(id: string) {
    return this.requireRequest(id, {
      customer: { select: { id: true, fullName: true, phone: true, email: true } },
      unit: true,
      category: true,
      assignedAdmin: { select: { id: true, fullName: true } },
      items: { include: { category: true } },
    });
  }

  // Assign a request to an active ADMIN. Auto-advances OPEN → ASSIGNED; never
  // downgrades a request already past ASSIGNED.
  async assign(id: string, assignedAdminId: string) {
    await this.assertAssignableAdmin(assignedAdminId);
    const current = await this.requireRequest(id);
    const data: Prisma.MaintenanceRequestUncheckedUpdateInput = { assignedAdminId };
    if (current.status === MaintenanceStatus.OPEN) {
      data.status = MaintenanceStatus.ASSIGNED;
    }
    if (current.assignedAt == null) data.assignedAt = new Date();
    const updated = await this.prisma.maintenanceRequest.update({ where: { id }, data });
    await this.notifyAssigned(id);
    return updated;
  }

  // Drive a status change through the allowed transition graph, applying the
  // lifecycle-timestamp side effects. These track the CURRENT lifecycle (not a
  // historical audit): a RESOLVED→IN_PROGRESS reopen clears resolvedAt, and the
  // next RESOLVED sets a fresh one.
  async setStatus(id: string, next: MaintenanceStatus) {
    const current = await this.requireRequest(id);
    if (current.status === next) return current; // no-op
    const allowed = STATUS_TRANSITIONS[current.status] ?? [];
    if (!allowed.includes(next)) {
      throw new BadRequestException('Invalid maintenance status transition');
    }
    const now = new Date();
    const data: Prisma.MaintenanceRequestUncheckedUpdateInput = { status: next };
    if (next === MaintenanceStatus.IN_PROGRESS) {
      if (current.firstInProgressAt == null) data.firstInProgressAt = now;
      // Reopen from RESOLVED → the request is no longer resolved.
      if (current.status === MaintenanceStatus.RESOLVED) data.resolvedAt = null;
    } else if (next === MaintenanceStatus.RESOLVED) {
      if (current.resolvedAt == null) data.resolvedAt = now;
    } else if (next === MaintenanceStatus.CLOSED) {
      data.closedAt = now;
      if (current.resolvedAt == null) data.resolvedAt = now;
    }
    const updated = await this.prisma.maintenanceRequest.update({ where: { id }, data });
    await this.notifyStatus(id);
    return updated;
  }

  private async requireRequest(id: string, include?: Prisma.MaintenanceRequestInclude) {
    const req = await this.prisma.maintenanceRequest.findUnique({ where: { id }, include });
    if (!req) throw new NotFoundException('Maintenance request not found');
    return req;
  }

  // An assignee may be active ADMIN staff or an active MAINTENANCE_SUPERVISOR.
  // (The column is still named assignedAdminId for v1 — see Batch 10 report.)
  private async assertAssignableAdmin(userId: string) {
    const staff = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, active: true },
    });
    if (!staff || (staff.role !== UserRole.ADMIN && staff.role !== UserRole.MAINTENANCE_SUPERVISOR)) {
      throw new BadRequestException('Assignee must be an admin or maintenance supervisor');
    }
    if (!staff.active) throw new BadRequestException('Assignee is inactive');
  }

  // ── Supervisor mobile surface (scoped to assignedAdminId === userId) ──────

  // Supervisors only see assigned requests that have been APPROVED — pending/
  // rejected requests stay off their active work list.
  supervisorList(userId: string, page: number, pageSize: number) {
    return this.list({
      page,
      pageSize,
      assignedAdminId: userId,
      reviewStatus: MaintenanceReviewStatus.APPROVED,
    });
  }

  async supervisorFindOne(userId: string, id: string) {
    const req = await this.requireRequest(id, {
      customer: { select: { id: true, fullName: true, phone: true, email: true } },
      unit: true,
      category: true,
      assignedAdmin: { select: { id: true, fullName: true } },
    });
    if (req.assignedAdminId !== userId) {
      throw new NotFoundException('Maintenance request not found');
    }
    const documents = await this.documents.listForOwner(
      DocumentOwnerType.MAINTENANCE_REQUEST,
      id,
      20,
    );
    return { ...req, documents };
  }

  async supervisorSetStatus(userId: string, id: string, next: MaintenanceStatus) {
    const current = await this.assertSupervisorOwns(userId, id);
    // No field work on a request that hasn't cleared admin review.
    if (current.reviewStatus !== MaintenanceReviewStatus.APPROVED) {
      throw new BadRequestException('Request is not approved');
    }
    const allowed = SUPERVISOR_TRANSITIONS[current.status] ?? [];
    if (!allowed.includes(next)) {
      throw new BadRequestException('Invalid maintenance status transition');
    }
    // Reuse the canonical setStatus — it re-validates against the (wider)
    // global graph and fires the best-effort notifications.
    return this.setStatus(id, next);
  }

  async supervisorPresign(userId: string, id: string, dto: MaintenanceDocPresignDto) {
    await this.assertSupervisorOwns(userId, id);
    return this.documents.presign(dto);
  }

  async supervisorCreateDocument(userId: string, id: string, dto: MaintenanceDocDto) {
    await this.assertSupervisorOwns(userId, id);
    // Supervisor work photos are internal by default.
    return this.attachMaintenancePhoto(userId, id, dto, DocumentVisibility.ADMIN_ONLY);
  }

  // ── Customer self-service (scoped to request.customerId) ──────────────────

  // Single-request detail for the customer who filed it. Only CUSTOMER_VISIBLE
  // documents are returned — internal supervisor photos (ADMIN_ONLY) are hidden.
  async customerFindOne(userId: string, id: string) {
    const req = await this.requireRequest(id, {
      unit: true,
      category: true,
      assignedAdmin: { select: { id: true, fullName: true } },
    });
    if (req.customerId !== userId) {
      throw new NotFoundException('Maintenance request not found');
    }
    const documents = await this.documents.listForOwner(
      DocumentOwnerType.MAINTENANCE_REQUEST,
      id,
      50,
      DocumentVisibility.CUSTOMER_VISIBLE,
    );
    // SECURITY: same posture as /me/documents — never return the permanent
    // `fileUrl` to a customer-facing response. The customer reaches the file
    // through `GET /v1/me/documents/:id/download`, which mints a short-lived
    // signed URL per click. Map to the same safe metadata shape that
    // `MeDocumentsController.list` returns.
    const safeDocs = documents.map((d) => ({
      id: d.id,
      title: d.title,
      fileName: d.fileName,
      mimeType: d.mimeType,
      category: d.category,
      createdAt: d.createdAt,
    }));
    return { ...req, documents: safeDocs };
  }

  async customerPresign(userId: string, id: string, dto: MaintenanceDocPresignDto) {
    await this.assertCustomerOwns(userId, id);
    return this.documents.presign(dto);
  }

  async customerCreateDocument(userId: string, id: string, dto: MaintenanceDocDto) {
    await this.assertCustomerOwns(userId, id);
    // The customer's own photo stays visible to them (and to staff).
    return this.attachMaintenancePhoto(userId, id, dto, DocumentVisibility.CUSTOMER_VISIBLE);
  }

  // ── Resolution loop (Phase A): confirm / complaint / unresolved ───────────

  /** Derive resolvedBy from the two confirmation timestamps. */
  private resolvedByFrom(
    customerAt: Date | null,
    supervisorAt: Date | null,
  ): MaintenanceResolutionConfirmedBy | null {
    if (customerAt && supervisorAt) return MaintenanceResolutionConfirmedBy.BOTH;
    if (customerAt) return MaintenanceResolutionConfirmedBy.CUSTOMER;
    if (supervisorAt) return MaintenanceResolutionConfirmedBy.SUPERVISOR;
    return null;
  }

  /**
   * Best-effort notification for resolution-loop events. Always reaches ADMINs
   * (+ the assignee); the customer is added for the unresolved escalation.
   * Payload carries deep-link metadata (entityType/entityId/requestId/action).
   */
  private async notifyResolutionEvent(
    id: string,
    code: string,
    action: string,
    opts: { toCustomer?: boolean; extra?: Record<string, unknown> } = {},
  ) {
    const r = await this.notifyContext(id);
    if (!r) return;
    const payload = {
      unitCode: r.unitCode,
      entityType: 'maintenance',
      entityId: id,
      requestId: id,
      action,
      ...(opts.extra ?? {}),
    };
    await this.notifications.sendToRoles([UserRole.ADMIN], code, payload);
    if (r.assignedAdminId) await this.notifications.sendToUser(r.assignedAdminId, code, payload);
    if (opts.toCustomer) await this.notifications.sendToUser(r.customerId, code, payload);
  }

  /**
   * Customer confirms a RESOLVED/CLOSED request with a required 1–5 rating +
   * optional note. One-time (customerConfirmedResolutionAt guards it). Sets
   * resolvedBy = CUSTOMER, or BOTH if the supervisor already confirmed.
   */
  async customerConfirmResolution(userId: string, id: string, dto: ConfirmResolutionDto) {
    const req = await this.assertCustomerOwns(userId, id);
    if (req.status !== MaintenanceStatus.RESOLVED && req.status !== MaintenanceStatus.CLOSED) {
      throw new BadRequestException('يمكن تأكيد الحل بعد إتمام الإصلاح فقط');
    }
    if (req.customerConfirmedResolutionAt) {
      throw new BadRequestException('لقد قمت بتأكيد الحل وتقييمه مسبقاً');
    }
    const now = new Date();
    await this.prisma.maintenanceRequest.update({
      where: { id },
      data: {
        customerConfirmedResolutionAt: now,
        customerRating: dto.rating,
        customerRatingText: dto.note?.trim() || null,
        customerRatingSubmittedAt: now,
        resolvedBy: this.resolvedByFrom(now, req.supervisorConfirmedResolutionAt),
      },
    });
    await this.notifyResolutionEvent(
      id,
      'maintenance_request_resolution_confirmed',
      'view_maintenance_resolution',
      { extra: { by: 'CUSTOMER', rating: dto.rating } },
    );
    return this.customerFindOne(userId, id);
  }

  /**
   * Assigned supervisor explicitly confirms resolution (no rating). One-time.
   * Status RESOLVED status means "work done"; this endpoint is the explicit
   * supervisor attestation, kept separate from supervisorSetStatus so a RESOLVED
   * transition is not silently treated as a confirmation. Sets resolvedBy =
   * SUPERVISOR, or BOTH if the customer already confirmed.
   */
  async supervisorConfirmResolution(userId: string, id: string) {
    const req = await this.assertSupervisorOwns(userId, id);
    if (req.reviewStatus !== MaintenanceReviewStatus.APPROVED) {
      throw new BadRequestException('Request is not approved');
    }
    if (req.status !== MaintenanceStatus.RESOLVED && req.status !== MaintenanceStatus.CLOSED) {
      throw new BadRequestException('يمكن تأكيد الحل بعد وضع الطلب كمُنجز فقط');
    }
    if (req.supervisorConfirmedResolutionAt) {
      throw new BadRequestException('تم تأكيد الحل من قبلك مسبقاً');
    }
    const now = new Date();
    await this.prisma.maintenanceRequest.update({
      where: { id },
      data: {
        supervisorConfirmedResolutionAt: now,
        resolvedBy: this.resolvedByFrom(req.customerConfirmedResolutionAt, now),
      },
    });
    await this.notifyResolutionEvent(
      id,
      'maintenance_request_resolution_confirmed',
      'view_maintenance_resolution',
      { extra: { by: 'SUPERVISOR' } },
    );
    return this.supervisorFindOne(userId, id);
  }

  /**
   * Customer files a complaint — allowed only when the request is ≥24h past its
   * dueAt and still unresolved, and only once.
   */
  async customerComplaint(userId: string, id: string) {
    const req = await this.assertCustomerOwns(userId, id);
    if (req.status === MaintenanceStatus.RESOLVED || req.status === MaintenanceStatus.CLOSED) {
      throw new BadRequestException('لا يمكن تقديم شكوى على طلب تم حله أو إغلاقه');
    }
    if (!req.dueAt) {
      throw new BadRequestException('لا يمكن تقديم شكوى قبل اعتماد الطلب وبدء مدة المعالجة');
    }
    if (Date.now() - req.dueAt.getTime() < COMPLAINT_OVERDUE_MS) {
      throw new BadRequestException(
        'يمكن تقديم شكوى بعد تجاوز الموعد المستهدف بـ 24 ساعة على الأقل',
      );
    }
    if (req.complaintAt) {
      throw new BadRequestException('تم تسجيل شكوى لهذا الطلب مسبقاً');
    }
    await this.prisma.maintenanceRequest.update({
      where: { id },
      data: { complaintAt: new Date() },
    });
    await this.notifyResolutionEvent(
      id,
      'maintenance_request_complaint_submitted',
      'review_maintenance_complaint',
    );
    return this.customerFindOne(userId, id);
  }

  /**
   * Cron sweep — flags complaints older than the unresolved window as
   * unresolved (durable `unresolvedAt`, no status enum change). Idempotent: the
   * updateMany guard (`unresolvedAt: null`) means a re-run never re-flags or
   * re-notifies a row. Returns aggregate counts for logging/tests.
   */
  async markUnresolved(): Promise<{ scanned: number; marked: number }> {
    const threshold = new Date(Date.now() - UNRESOLVED_AFTER_COMPLAINT_MS);
    const candidates = await this.prisma.maintenanceRequest.findMany({
      where: {
        complaintAt: { not: null, lte: threshold },
        unresolvedAt: null,
        status: { notIn: [MaintenanceStatus.RESOLVED, MaintenanceStatus.CLOSED] },
      },
      select: { id: true },
    });
    let marked = 0;
    for (const c of candidates) {
      const res = await this.prisma.maintenanceRequest.updateMany({
        where: { id: c.id, unresolvedAt: null },
        data: { unresolvedAt: new Date() },
      });
      if (res.count > 0) {
        marked++;
        await this.notifyResolutionEvent(
          c.id,
          'maintenance_request_unresolved',
          'maintenance_unresolved',
          { toCustomer: true },
        );
      }
    }
    this.logger.log(`Maintenance unresolved sweep: scanned=${candidates.length} marked=${marked}`);
    return { scanned: candidates.length, marked };
  }

  // Shared document-create path: owner/category are forced server-side; only
  // the visibility differs per caller. Reuses the documents service so the
  // create logic (URL safety, owner existence) is never duplicated.
  private attachMaintenancePhoto(
    uploadedById: string,
    id: string,
    dto: MaintenanceDocDto,
    visibility: DocumentVisibility,
  ) {
    return this.documents.create(uploadedById, {
      ownerType: DocumentOwnerType.MAINTENANCE_REQUEST,
      ownerId: id,
      category: DocumentCategory.IMAGE,
      title: dto.title,
      description: dto.description,
      fileUrl: dto.fileUrl,
      fileName: dto.fileName,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      visibility,
    });
  }

  // 404 (not 403) for unassigned/foreign requests so a supervisor can't probe
  // which request ids exist.
  private async assertSupervisorOwns(userId: string, id: string) {
    const req = await this.requireRequest(id);
    if (req.assignedAdminId !== userId) {
      throw new NotFoundException('Maintenance request not found');
    }
    return req;
  }

  // 404 (not 403) for a request the customer doesn't own — never leak existence.
  private async assertCustomerOwns(userId: string, id: string) {
    const req = await this.requireRequest(id);
    if (req.customerId !== userId) {
      throw new NotFoundException('Maintenance request not found');
    }
    return req;
  }

  // Build a createdAt range filter, ignoring unparseable dates (safe no-op).
  private createdAtRange(from?: string, to?: string): Prisma.MaintenanceRequestWhereInput {
    const start = from ? new Date(from) : null;
    const end = to ? new Date(to) : null;
    const gte = start && !Number.isNaN(start.getTime()) ? start : null;
    const lte = end && !Number.isNaN(end.getTime()) ? end : null;
    if (!gte && !lte) return {};
    return { createdAt: { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) } };
  }

  async list(opts: {
    page: number;
    pageSize: number;
    status?: MaintenanceStatus;
    customerId?: string;
    assignedAdminId?: string;
    reviewStatus?: MaintenanceReviewStatus;
    categoryId?: string;
    from?: string;
    to?: string;
  }) {
    const where: Prisma.MaintenanceRequestWhereInput = {
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.customerId ? { customerId: opts.customerId } : {}),
      ...(opts.assignedAdminId ? { assignedAdminId: opts.assignedAdminId } : {}),
      ...(opts.reviewStatus ? { reviewStatus: opts.reviewStatus } : {}),
      // Category match: either a request item references it (new multi-category
      // model) or the legacy single categoryId does (back-compat).
      ...(opts.categoryId
        ? {
            OR: [
              { items: { some: { categoryId: opts.categoryId } } },
              { categoryId: opts.categoryId },
            ],
          }
        : {}),
      ...this.createdAtRange(opts.from, opts.to),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.maintenanceRequest.findMany({
        where,
        ...takeSkip(opts),
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, fullName: true } },
          category: true,
          unit: true,
        },
      }),
      this.prisma.maintenanceRequest.count({ where }),
    ]);
    return paginate(data, total, opts);
  }

  // Operational reporting summary for the admin dashboard. Read-only aggregate
  // over maintenance requests (+ their item snapshots) and expiring unit
  // warranties. avgResolutionHours is null: the schema has no resolvedAt/
  // closedAt timestamp, so resolution duration can't be derived reliably
  // (updatedAt is bumped by any edit). See Batch 14 report.
  async reportsSummary(opts: {
    from?: string;
    to?: string;
    assignedAdminId?: string;
    categoryId?: string;
    reviewStatus?: MaintenanceReviewStatus;
    status?: MaintenanceStatus;
  }) {
    const where: Prisma.MaintenanceRequestWhereInput = {
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.reviewStatus ? { reviewStatus: opts.reviewStatus } : {}),
      ...(opts.assignedAdminId ? { assignedAdminId: opts.assignedAdminId } : {}),
      // A request "has" a category when one of its items references it.
      ...(opts.categoryId ? { items: { some: { categoryId: opts.categoryId } } } : {}),
      ...this.createdAtRange(opts.from, opts.to),
    };

    const requests = await this.prisma.maintenanceRequest.findMany({
      where,
      select: {
        id: true,
        status: true,
        reviewStatus: true,
        dueAt: true,
        approvedAt: true,
        resolvedAt: true,
        createdAt: true,
        assignedAdminId: true,
        assignedAdmin: { select: { id: true, fullName: true } },
        items: {
          select: {
            warrantyStatusSnapshot: true,
            categoryId: true,
            category: { select: { id: true, name: true } },
          },
        },
      },
    });

    const now = Date.now();
    const isOverdue = (r: (typeof requests)[number]) =>
      r.reviewStatus === MaintenanceReviewStatus.APPROVED &&
      r.status !== MaintenanceStatus.CLOSED &&
      !!r.dueAt &&
      r.dueAt.getTime() < now;

    const summary = {
      totalRequests: requests.length,
      pendingReviewCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      openCount: 0,
      assignedCount: 0,
      inProgressCount: 0,
      resolvedCount: 0,
      closedCount: 0,
      overdueCount: 0,
      inWarrantyCount: 0,
      outOfWarrantyCount: 0,
      unknownWarrantyCount: 0,
      avgResolutionHours: null as number | null,
      resolvedWithinSlaCount: 0,
      resolvedOverdueCount: 0,
      slaAttainmentPercent: null as number | null,
      avgDelayHours: null as number | null,
    };

    // Accumulators for the resolution-time + SLA-attainment metrics.
    const resolutionHours: number[] = [];
    const delayHours: number[] = [];

    const byCategory = new Map<
      string,
      { categoryId: string; categoryName: unknown; count: number; overdueCount: number; outOfWarrantyCount: number }
    >();
    const byAssignee = new Map<
      string,
      { userId: string; name: string; count: number; overdueCount: number; inProgressCount: number }
    >();

    for (const r of requests) {
      if (r.reviewStatus === MaintenanceReviewStatus.PENDING) summary.pendingReviewCount++;
      else if (r.reviewStatus === MaintenanceReviewStatus.APPROVED) summary.approvedCount++;
      else if (r.reviewStatus === MaintenanceReviewStatus.REJECTED) summary.rejectedCount++;

      if (r.status === MaintenanceStatus.OPEN) summary.openCount++;
      else if (r.status === MaintenanceStatus.ASSIGNED) summary.assignedCount++;
      else if (r.status === MaintenanceStatus.IN_PROGRESS) summary.inProgressCount++;
      else if (r.status === MaintenanceStatus.RESOLVED) summary.resolvedCount++;
      else if (r.status === MaintenanceStatus.CLOSED) summary.closedCount++;

      const overdue = isOverdue(r);
      if (overdue) summary.overdueCount++;

      // Resolution-time + SLA attainment (resolved requests only).
      if (r.resolvedAt) {
        // Prefer approvedAt as the SLA clock start; fall back to createdAt for
        // legacy/admin records where approvedAt may be null.
        const start = (r.approvedAt ?? r.createdAt).getTime();
        resolutionHours.push((r.resolvedAt.getTime() - start) / 3_600_000);
        if (r.dueAt) {
          if (r.resolvedAt.getTime() <= r.dueAt.getTime()) {
            summary.resolvedWithinSlaCount++;
          } else {
            summary.resolvedOverdueCount++;
            delayHours.push((r.resolvedAt.getTime() - r.dueAt.getTime()) / 3_600_000);
          }
        }
      }

      for (const it of r.items) {
        if (it.warrantyStatusSnapshot === WarrantyStatus.IN_WARRANTY) summary.inWarrantyCount++;
        else if (it.warrantyStatusSnapshot === WarrantyStatus.OUT_OF_WARRANTY) summary.outOfWarrantyCount++;
        else summary.unknownWarrantyCount++;

        const key = it.categoryId;
        const c = byCategory.get(key) ?? {
          categoryId: key,
          categoryName: it.category?.name ?? null,
          count: 0,
          overdueCount: 0,
          outOfWarrantyCount: 0,
        };
        c.count++;
        if (overdue) c.overdueCount++;
        if (it.warrantyStatusSnapshot === WarrantyStatus.OUT_OF_WARRANTY) c.outOfWarrantyCount++;
        byCategory.set(key, c);
      }

      if (r.assignedAdminId) {
        const a = byAssignee.get(r.assignedAdminId) ?? {
          userId: r.assignedAdminId,
          name: r.assignedAdmin?.fullName ?? '—',
          count: 0,
          overdueCount: 0,
          inProgressCount: 0,
        };
        a.count++;
        if (overdue) a.overdueCount++;
        if (r.status === MaintenanceStatus.IN_PROGRESS) a.inProgressCount++;
        byAssignee.set(r.assignedAdminId, a);
      }
    }

    // Finalize derived averages/percentages.
    const avg = (xs: number[]) =>
      xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null;
    summary.avgResolutionHours = avg(resolutionHours);
    summary.avgDelayHours = avg(delayHours);
    const slaDenom = summary.resolvedWithinSlaCount + summary.resolvedOverdueCount;
    summary.slaAttainmentPercent =
      slaDenom > 0 ? Math.round((summary.resolvedWithinSlaCount / slaDenom) * 1000) / 10 : null;

    // Warranties ending within the next 30 days (independent of request filters).
    const horizon = new Date(now + 30 * 24 * 60 * 60 * 1000);
    const expiringRows = await this.prisma.unitMaintenanceItem.findMany({
      where: { active: true, warrantyEnd: { gte: new Date(now), lte: horizon } },
      orderBy: { warrantyEnd: 'asc' },
      take: 50,
      select: {
        id: true,
        warrantyEnd: true,
        name: true,
        unit: { select: { code: true } },
        category: { select: { name: true } },
      },
    });

    return {
      ...summary,
      byCategory: [...byCategory.values()].sort((a, b) => b.count - a.count),
      byAssignee: [...byAssignee.values()].sort((a, b) => b.count - a.count),
      expiringWarranties: expiringRows.map((e) => ({
        id: e.id,
        unitCode: e.unit?.code ?? '—',
        categoryName: e.category?.name ?? e.name ?? null,
        warrantyEnd: e.warrantyEnd,
      })),
    };
  }

  // CSV export of the operational report — same filters, multi-section layout
  // (summary KPIs, category breakdown, assignee breakdown, expiring warranties).
  async reportsSummaryCsv(opts: {
    from?: string;
    to?: string;
    assignedAdminId?: string;
    categoryId?: string;
    reviewStatus?: MaintenanceReviewStatus;
    status?: MaintenanceStatus;
  }) {
    const r = await this.reportsSummary(opts);
    const txAr = (v: unknown): string => {
      if (!v) return '—';
      if (typeof v === 'string') return v;
      const t = v as { ar?: string; en?: string };
      return t.ar || t.en || '—';
    };
    const fmtDate = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : '—');

    const summaryRows: CsvCell[][] = [
      ['totalRequests', 'إجمالي الطلبات', r.totalRequests],
      ['pendingReviewCount', 'قيد المراجعة', r.pendingReviewCount],
      ['approvedCount', 'معتمدة', r.approvedCount],
      ['rejectedCount', 'مرفوضة', r.rejectedCount],
      ['openCount', 'مفتوحة', r.openCount],
      ['assignedCount', 'مسندة', r.assignedCount],
      ['inProgressCount', 'قيد التنفيذ', r.inProgressCount],
      ['resolvedCount', 'تم الحل', r.resolvedCount],
      ['closedCount', 'مغلقة', r.closedCount],
      ['overdueCount', 'متأخرة', r.overdueCount],
      ['inWarrantyCount', 'تحت الضمان', r.inWarrantyCount],
      ['outOfWarrantyCount', 'خارج الضمان', r.outOfWarrantyCount],
      ['unknownWarrantyCount', 'ضمان غير معروف', r.unknownWarrantyCount],
      ['avgResolutionHours', 'متوسط زمن المعالجة (ساعة)', r.avgResolutionHours ?? '—'],
      ['resolvedWithinSlaCount', 'تم الحل ضمن المدة', r.resolvedWithinSlaCount],
      ['resolvedOverdueCount', 'تم الحل بعد الموعد', r.resolvedOverdueCount],
      ['slaAttainmentPercent', 'نسبة الالتزام بالمدة (٪)', r.slaAttainmentPercent ?? '—'],
      ['avgDelayHours', 'متوسط التأخير (ساعة)', r.avgDelayHours ?? '—'],
    ];

    const categoryRows: CsvCell[][] = r.byCategory.map((c) => [
      'category',
      txAr(c.categoryName),
      c.count,
      c.overdueCount,
      c.outOfWarrantyCount,
    ]);

    const assigneeRows: CsvCell[][] = r.byAssignee.map((a) => [
      'assignee',
      a.name,
      a.count,
      a.overdueCount,
      a.inProgressCount,
    ]);

    const expiringRows: CsvCell[][] = r.expiringWarranties.map((e) => [
      'expiring',
      e.unitCode,
      txAr(e.categoryName),
      fmtDate(e.warrantyEnd),
    ]);

    return [
      toCsv(['metric', 'label', 'value'], summaryRows),
      '',
      toCsv(['section', 'category', 'count', 'overdueCount', 'outOfWarrantyCount'], categoryRows),
      '',
      toCsv(['section', 'assignee', 'count', 'overdueCount', 'inProgressCount'], assigneeRows),
      '',
      toCsv(['section', 'unitCode', 'categoryName', 'warrantyEnd'], expiringRows),
    ].join('\r\n');
  }

  /**
   * P15.3 — styled XLSX twin of reportsSummaryCsv. Same real report (summary +
   * by-category + by-assignee + expiring warranties), one sheet per section,
   * applied filters surfaced on the summary sheet. No demo values.
   */
  async reportsSummaryXlsx(opts: {
    from?: string;
    to?: string;
    assignedAdminId?: string;
    categoryId?: string;
    reviewStatus?: MaintenanceReviewStatus;
    status?: MaintenanceStatus;
  }): Promise<Buffer> {
    const r = await this.reportsSummary(opts);
    const txAr = (v: unknown): string => {
      if (!v) return '—';
      if (typeof v === 'string') return v;
      const t = v as { ar?: string; en?: string };
      return t.ar || t.en || '—';
    };
    const fmtDate = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : '—');
    const STATUS_AR: Record<string, string> = {
      OPEN: 'مفتوحة', ASSIGNED: 'مسندة', IN_PROGRESS: 'قيد التنفيذ',
      RESOLVED: 'تم الحل', CLOSED: 'مغلقة',
    };
    const REVIEW_AR: Record<string, string> = {
      PENDING: 'قيد المراجعة', APPROVED: 'معتمدة', REJECTED: 'مرفوضة',
    };

    const wb = createReportWorkbook();
    const sum = wb.addWorksheet('الملخص');
    addTitledTable(sum, {
      title: 'تقرير الصيانة',
      filters: [
        ['من', opts.from ?? ''],
        ['إلى', opts.to ?? ''],
        ['الحالة', opts.status ? (STATUS_AR[opts.status] ?? opts.status) : ''],
        ['حالة المراجعة', opts.reviewStatus ? (REVIEW_AR[opts.reviewStatus] ?? opts.reviewStatus) : ''],
        ['المسند إليه', opts.assignedAdminId ? 'موظف محدد' : ''],
        ['الفئة', opts.categoryId ? 'فئة محددة' : ''],
      ],
      headers: ['المؤشر', 'القيمة'],
      rows: [
        ['إجمالي الطلبات', r.totalRequests],
        ['قيد المراجعة', r.pendingReviewCount],
        ['معتمدة', r.approvedCount],
        ['مرفوضة', r.rejectedCount],
        ['مفتوحة', r.openCount],
        ['مسندة', r.assignedCount],
        ['قيد التنفيذ', r.inProgressCount],
        ['تم الحل', r.resolvedCount],
        ['مغلقة', r.closedCount],
        ['متأخرة', r.overdueCount],
        ['تحت الضمان', r.inWarrantyCount],
        ['خارج الضمان', r.outOfWarrantyCount],
        ['ضمان غير معروف', r.unknownWarrantyCount],
        ['متوسط زمن المعالجة (ساعة)', r.avgResolutionHours ?? '—'],
        ['تم الحل ضمن المدة', r.resolvedWithinSlaCount],
        ['تم الحل بعد الموعد', r.resolvedOverdueCount],
        ['نسبة الالتزام بالمدة (٪)', r.slaAttainmentPercent ?? '—'],
        ['متوسط التأخير (ساعة)', r.avgDelayHours ?? '—'],
      ],
      widths: [34, 16],
    });
    addFooter(sum);

    const cat = wb.addWorksheet('حسب الفئة');
    addTable(
      cat,
      ['الفئة', 'العدد', 'متأخرة', 'خارج الضمان'],
      r.byCategory.map((c) => [txAr(c.categoryName), c.count, c.overdueCount, c.outOfWarrantyCount]),
      [28, 12, 12, 14],
    );

    const assignee = wb.addWorksheet('حسب المسند إليه');
    addTable(
      assignee,
      ['المسند إليه', 'العدد', 'متأخرة', 'قيد التنفيذ'],
      r.byAssignee.map((a) => [a.name, a.count, a.overdueCount, a.inProgressCount]),
      [28, 12, 12, 14],
    );

    const expiring = wb.addWorksheet('ضمانات تنتهي قريباً');
    addTable(
      expiring,
      ['الوحدة', 'الفئة', 'نهاية الضمان'],
      r.expiringWarranties.map((e) => [e.unitCode, txAr(e.categoryName), fmtDate(e.warrantyEnd)]),
      [18, 24, 16],
    );

    return workbookToBuffer(wb);
  }
}

@ApiTags('maintenance')
@Controller()
class MaintenanceController {
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

/**
 * Hourly sweep that flags complaints older than the unresolved window. Mirrors
 * the always-on InstallmentsCron pattern; `markUnresolved()` is idempotent so
 * re-runs are safe. ScheduleModule is registered globally in AppModule.
 */
@Injectable()
class MaintenanceUnresolvedCron {
  constructor(private readonly svc: MaintenanceService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run() {
    await this.svc.markUnresolved();
  }
}

@Module({
  imports: [DocumentsModule, MediaModule, NotificationsModule],
  controllers: [MaintenanceController],
  providers: [MaintenanceService, MaintenanceUnresolvedCron],
})
export class MaintenanceModule {}
