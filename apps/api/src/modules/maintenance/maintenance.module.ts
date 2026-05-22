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
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  Prisma,
  MaintenanceStatus,
  MaintenancePriority,
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
import { DocumentsModule, DocumentsService } from '../documents/documents.module';
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

@Injectable()
class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
  ) {}

  // ── Notifications (best-effort, IN_APP; never fail the maintenance action) ──

  private async createNotifications(
    userIds: Array<string | null | undefined>,
    templateCode: string,
    payload: Prisma.InputJsonValue,
  ) {
    const ids = [...new Set(userIds.filter((id): id is string => !!id))];
    if (ids.length === 0) return;
    await this.prisma.notification.createMany({
      data: ids.map((userId) => ({
        userId,
        templateCode,
        payload,
        channel: NotificationChannel.IN_APP,
        sentAt: new Date(),
      })),
    });
  }

  private async activeAdminIds(): Promise<string[]> {
    const admins = await this.prisma.user.findMany({
      where: { role: UserRole.ADMIN, active: true },
      select: { id: true },
    });
    return admins.map((a) => a.id);
  }

  // Notify staff (+ assignee) that a request was created. Best-effort.
  private async notifyCreated(unitCode: string, assignedAdminId?: string | null) {
    try {
      await this.createNotifications(await this.activeAdminIds(), 'maintenance_request_created', {
        unitCode,
      });
      if (assignedAdminId) {
        await this.createNotifications([assignedAdminId], 'maintenance_request_assigned', {
          unitCode,
        });
      }
    } catch (e) {
      this.logger.warn(`notifyCreated failed: ${(e as Error).message}`);
    }
  }

  // Notify assignee + customer that a request was assigned. Best-effort.
  private async notifyAssigned(id: string) {
    try {
      const r = await this.notifyContext(id);
      if (!r) return;
      await this.createNotifications([r.assignedAdminId], 'maintenance_request_assigned', {
        unitCode: r.unitCode,
      });
      await this.createNotifications([r.customerId], 'maintenance_request_status_changed', {
        unitCode: r.unitCode,
        statusLabel: STATUS_LABEL_AR[r.status],
      });
    } catch (e) {
      this.logger.warn(`notifyAssigned failed: ${(e as Error).message}`);
    }
  }

  // Notify customer (+ assignee) of a status change. Best-effort.
  private async notifyStatus(id: string) {
    try {
      const r = await this.notifyContext(id);
      if (!r) return;
      const code =
        r.status === MaintenanceStatus.RESOLVED
          ? 'maintenance_request_resolved'
          : r.status === MaintenanceStatus.CLOSED
            ? 'maintenance_request_closed'
            : 'maintenance_request_status_changed';
      const payload = { unitCode: r.unitCode, statusLabel: STATUS_LABEL_AR[r.status] };
      await this.createNotifications([r.customerId], code, payload);
      if (r.assignedAdminId) {
        await this.createNotifications([r.assignedAdminId], 'maintenance_request_status_changed', payload);
      }
    } catch (e) {
      this.logger.warn(`notifyStatus failed: ${(e as Error).message}`);
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
    await this.notifyCreated(unit.code);
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
    await this.notifyCreated(unit.code, assignedAdminId);
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
    try {
      await this.createNotifications([req.customerId], 'maintenance_request_status_changed', {
        statusLabel: 'تمت الموافقة',
      });
    } catch (e) {
      this.logger.warn(`approve notify failed: ${(e as Error).message}`);
    }
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
    try {
      await this.createNotifications([req.customerId], 'maintenance_request_status_changed', {
        statusLabel: 'مرفوض',
      });
    } catch (e) {
      this.logger.warn(`reject notify failed: ${(e as Error).message}`);
    }
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
    return { ...req, documents };
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

  // Customer self-service — intentionally NOT permission-gated.
  @Roles(UserRole.CUSTOMER)
  @Post('me/maintenance-requests')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRequestDto) {
    return this.svc.createRequest(user.sub, dto);
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

@Module({
  imports: [DocumentsModule],
  controllers: [MaintenanceController],
  providers: [MaintenanceService],
})
export class MaintenanceModule {}
