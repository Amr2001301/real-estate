import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../common/prisma/prisma.service';
import { phoneForWrite } from '../../common/utils/phone-for-write';
import { getRequiredCompanyId } from '../../common/tenant/tenant-context';
import { CreateUserDto, CUSTOMER_RECORD_KEYS, UpdateUserDto, type CustomerRecordDto } from './dto/user.dto';
import { mergeCustomValues } from '../customer-fields/custom-values';
import { MaintenanceStatus, AppointmentStatus, LeadStage, Prisma, ReservationStatus, UserRole, VisitStatus } from '@prisma/client';
import { assertAssignableSales } from '../../common/utils/assignable-sales';
import { LIVE_CONTRACT_WHERE } from '../installments/live-contract';
import { paginate, takeSkip, toCounts } from '../../common/utils/pagination';
import { OPTIONS_LIMIT, optionsResult } from '../../common/utils/options';
import { clientOwnerScope, ownedClientsWhere } from '../../common/utils/client-ownership';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { R2Service } from '../media/r2.service';
import { NotificationsService } from '../notifications/notifications.module';
import { USER_ROLE_AR } from '../notifications/notification-catalog';
import { resolvePrefs, type NotificationPrefs } from '../notifications/notification-groups';
import type { NotificationPrefsDto } from './dto/notification-prefs.dto';
import { PlanLimitService } from '../../common/capabilities/plan-limit.service';
import { collectPages, isoDate, listCsv, listXlsx, type ListColumn } from '../../common/utils/list-export';
import { ReportBrandService } from '../company-branding/report-brand.service';
import { grantRoleDefaultPermissions } from '../permissions/role-default-permissions';

/** People lists the admin can export: prospects (CLIENT) and buyers (CUSTOMER). */
export const EXPORTABLE_ROLES = ['CLIENT', 'CUSTOMER'] as const;
export type ExportableRole = (typeof EXPORTABLE_ROLES)[number];

type UserExportRow = {
  fullName: string | null;
  phone: string | null;
  email: string | null;
  active: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
};

/** Avatars: small images only, capped well below the document limit. */
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

/** Minimal shape of a multer file — avoids a hard @types/multer dependency. */
export interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
    private readonly notifications: NotificationsService,
    private readonly planLimits: PlanLimitService,
    // Optional so unit tests can build the service without it.
    @Optional() private readonly reportBrand?: ReportBrandService,
  ) {}

  // ── List export (the admin clients / customers pages) ───────────────────

  private static readonly EXPORT_COLUMNS: ListColumn<UserExportRow>[] = [
    { header: 'الاسم', width: 28, value: (u) => u.fullName },
    { header: 'الهاتف', width: 18, value: (u) => u.phone },
    { header: 'البريد الإلكتروني', width: 30, value: (u) => u.email },
    { header: 'الحالة', width: 10, value: (u) => (u.active ? 'نشط' : 'موقوف') },
    { header: 'تاريخ التسجيل', width: 14, value: (u) => isoDate(u.createdAt) },
    { header: 'آخر دخول', width: 14, value: (u) => isoDate(u.lastLoginAt) },
  ];

  private static readonly EXPORT_TITLE: Record<ExportableRole, string> = {
    CLIENT: 'قائمة المتصفّحين',
    CUSTOMER: 'قائمة العملاء',
  };

  private exportRows(role: ExportableRole, q?: string, active?: boolean): Promise<UserExportRow[]> {
    return collectPages((page, pageSize) => this.findAll(role, page, pageSize, q, active));
  }

  async exportXlsx(role: ExportableRole, q?: string, active?: boolean): Promise<Buffer> {
    const [rows, brand] = await Promise.all([
      this.exportRows(role, q, active),
      this.reportBrand?.forCompany(getRequiredCompanyId()),
    ]);
    return listXlsx({
      title: UsersService.EXPORT_TITLE[role],
      sheet: role === 'CLIENT' ? 'المتصفّحون' : 'العملاء',
      filters: [
        ['بحث', q ?? ''],
        ['الحالة', active === undefined ? '' : active ? 'نشط' : 'موقوف'],
      ],
      columns: UsersService.EXPORT_COLUMNS,
      rows,
      brand,
    });
  }

  async exportCsv(role: ExportableRole, q?: string, active?: boolean): Promise<string> {
    return listCsv(UsersService.EXPORT_COLUMNS, await this.exportRows(role, q, active));
  }

  async create(dto: CreateUserDto) {
    if (
      (dto.role === 'ADMIN' ||
        dto.role === 'SALES' ||
        dto.role === 'SALES_MANAGER' ||
        dto.role === 'MAINTENANCE_SUPERVISOR') &&
      !dto.password
    ) {
      throw new BadRequestException('Password required for staff roles');
    }
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Either email or phone is required');
    }

    // MT-003: resolve companyId from the tenant context.
    // SUPER_ADMIN bypass callers must use SuperAdminService.createCompanyUser()
    // which passes the target companyId explicitly — they never reach this path.
    const companyId = getRequiredCompanyId();

    await this.planLimits.checkUserLimit(dto.role);

    if (dto.managerId) await this.assertIsManager(dto.managerId, companyId);
    const phone = await phoneForWrite(this.prisma, dto.phone, companyId); // FG-21
    const passwordHash = dto.password ? await argon2.hash(dto.password) : null;
    const created = await this.prisma.user.create({
      data: {
        role: dto.role,
        fullName: dto.fullName,
        email: dto.email ?? null,
        phone: phone ?? null,
        passwordHash,
        locale: dto.locale ?? 'ar',
        managerId: dto.managerId ?? null,
        ...(await this.recordData(dto, companyId, null)),
        companyId,
      },
      select: this.publicSelect(),
    });
    // Their role's starting codes: without them every page refused them.
    await grantRoleDefaultPermissions(this.prisma, created.id, created.role);
    try {
      // Welcome (in-app, and by e-mail when they have one) …
      await this.notifications.sendToUser(created.id, 'user_account_created', {
        name: created.fullName,
        roleLabel: USER_ROLE_AR[created.role] ?? created.role,
        entityType: 'user',
        entityId: created.id,
      });
    } catch {
      // best-effort — creating the account must not fail on a notification
    }
    // … and the sales manager they report to meets them.
    if (created.managerId) await this.notifyTeamChange(created.id, created.fullName, created.managerId, null);
    return created;
  }

  /** A sales person moved between managers: they and both managers hear. */
  private async notifyTeamChange(
    userId: string,
    name: string,
    managerId: string | null,
    previousManagerId: string | null,
  ) {
    const payload = { name, entityType: 'user', entityId: userId };
    try {
      await this.sendTeamChange(userId, payload, managerId, previousManagerId);
    } catch {
      // best-effort — the assignment must not fail on a notification
    }
  }

  private async sendTeamChange(
    userId: string,
    payload: Record<string, unknown>,
    managerId: string | null,
    previousManagerId: string | null,
  ) {
    if (managerId) {
      const mgr = await this.prisma.user
        .findFirst({ where: { id: managerId, companyId: getRequiredCompanyId() }, select: { fullName: true } })
        .catch(() => null);
      await this.notifications.sendToUser(userId, 'manager_assigned', {
        ...payload,
        managerName: mgr?.fullName ?? '',
      });
      await this.notifications.sendToUser(managerId, 'team_member_added', payload);
    }
    if (previousManagerId && previousManagerId !== managerId) {
      await this.notifications.sendToUser(previousManagerId, 'team_member_removed', payload);
    }
  }

  /** The caller's e-mail / push opt-outs, every group resolved (on unless off). */
  async getNotificationPreferences(userId: string): Promise<NotificationPrefs> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, companyId: getRequiredCompanyId() },
      select: { notificationPrefs: true },
    });
    return resolvePrefs(user?.notificationPrefs);
  }

  /** Changes only the groups sent; in-app notifications are never switched off. */
  async updateNotificationPreferences(
    userId: string,
    dto: NotificationPrefsDto,
  ): Promise<NotificationPrefs> {
    const companyId = getRequiredCompanyId();
    const current = await this.getNotificationPreferences(userId);
    const next = resolvePrefs({
      email: { ...current.email, ...(dto.email ?? {}) },
      push: { ...current.push, ...(dto.push ?? {}) },
    });
    await this.prisma.user.updateMany({
      where: { id: userId, companyId },
      data: { notificationPrefs: next as unknown as Prisma.InputJsonValue },
    });
    return next;
  }

  // ADMIN-only manager assignment. null clears it. A non-null managerId must
  // reference an existing SALES_MANAGER user within the same company.
  async assignManager(id: string, managerId: string | null) {
    const companyId = getRequiredCompanyId();
    await this.assertExists(id, companyId);
    if (managerId) await this.assertIsManager(managerId, companyId);
    const before = await this.prisma.user.findFirst({
      where: { id, companyId },
      select: { managerId: true },
    });
    const updated = await this.prisma.user.update({
      where: { id },
      data: { managerId: managerId ?? null },
      select: this.publicSelect(),
    });
    if ((before?.managerId ?? null) !== (managerId ?? null)) {
      await this.notifyTeamChange(id, updated.fullName, managerId, before?.managerId ?? null);
    }
    return updated;
  }

  // MT-010: companyId scopes the manager lookup to the same tenant.
  private async assertIsManager(managerId: string, companyId: string) {
    const mgr = await this.prisma.user.findFirst({
      where: { id: managerId, companyId },
      select: { role: true },
    });
    if (!mgr || mgr.role !== UserRole.SALES_MANAGER) {
      throw new BadRequestException('managerId must reference a SALES_MANAGER user');
    }
  }

  /**
   * Registered clients (CLIENT / CUSTOMER) the caller may act on — every one
   * for an ADMIN, owned ones for a rep or manager (client-ownership.ts). Name
   * and phone only: enough to pick, nothing to export.
   */
  async searchClients(user: AuthUser, q: string | undefined, pageSize: number) {
    const companyId = getRequiredCompanyId();
    const scope = await clientOwnerScope(this.prisma, user);
    const trimmed = q?.trim();
    const where: Prisma.UserWhereInput = {
      companyId,
      deletedAt: null,
      active: true,
      role: { in: [UserRole.CLIENT, UserRole.CUSTOMER] },
      ...(scope === null ? {} : ownedClientsWhere(scope)),
      ...(trimmed
        ? {
            AND: [
              {
                OR: [
                  { fullName: { contains: trimmed, mode: 'insensitive' } },
                  { phone: { contains: trimmed } },
                  { email: { contains: trimmed, mode: 'insensitive' } },
                ],
              },
            ],
          }
        : {}),
    };
    const data = await this.prisma.user.findMany({
      where,
      select: { id: true, fullName: true, phone: true, role: true },
      orderBy: { fullName: 'asc' },
      take: pageSize,
    });
    return { data };
  }

  /** Staff of the company, id + name + role — see common/utils/options.ts. */
  async options(roles: UserRole[], active?: boolean) {
    const rows = await this.prisma.user.findMany({
      where: {
        companyId: getRequiredCompanyId(),
        deletedAt: null,
        role: { in: roles },
        ...(active !== undefined ? { active } : {}),
      },
      select: { id: true, fullName: true, role: true, active: true },
      orderBy: { fullName: 'asc' },
      take: OPTIONS_LIMIT + 1,
    });
    return optionsResult(rows);
  }

  async findAll(role?: string, page = 1, pageSize = 20, q?: string, active?: boolean) {
    const companyId = getRequiredCompanyId(); // MT-004
    const trimmed = q?.trim();
    // `role` may be a single role or a comma-separated list (e.g.
    // "SALES,SALES_MANAGER") for sales-actor dropdowns. Backward compatible.
    const roles = role
      ? (role.split(',').map((r) => r.trim()).filter(Boolean) as UserRole[])
      : [];
    const roleFilter: Prisma.UserWhereInput =
      roles.length > 1 ? { role: { in: roles } } : roles.length === 1 ? { role: roles[0] } : {};
    const where: Prisma.UserWhereInput = {
      companyId,
      deletedAt: null,
      ...roleFilter,
      ...(active !== undefined ? { active } : {}),
      ...(trimmed
        ? {
            OR: [
              { fullName: { contains: trimmed, mode: 'insensitive' } },
              { phone: { contains: trimmed } },
              { email: { contains: trimmed, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        ...takeSkip({ page, pageSize }),
        orderBy: { createdAt: 'desc' },
        select: this.publicSelect(),
      }),
      this.prisma.user.count({ where }),
    ]);

    // FG-23 — the active/inactive split on /dashboard/users was counted
    // client-side from ?pageSize=100. `active` is a boolean column, so the
    // facet keys come back as "true" / "false".
    const [activeGroups, roleGroups, lastLoginAgg] = await Promise.all([
      this.prisma.user.groupBy({ by: ['active'], where, _count: true }),
      this.prisma.user.groupBy({ by: ['role'], where, _count: true }),
      this.prisma.user.aggregate({ where, _max: { lastLoginAt: true } }),
    ]);
    const facets = {
      counts: {
        active: toCounts(activeGroups.map((g) => [String(g.active), g._count] as const)),
        role: toCounts(roleGroups.map((g) => [String(g.role), g._count] as const)),
      },
      ...(lastLoginAgg._max.lastLoginAt
        ? { max: { lastLoginAt: lastLoginAgg._max.lastLoginAt.toISOString() } }
        : {}),
    };

    return paginate(data, total, { page, pageSize }, facets);
  }

  async findOne(id: string) {
    const companyId = getRequiredCompanyId(); // MT-005
    const user = await this.prisma.user.findFirst({
      where: { id, companyId, deletedAt: null },
      select: this.publicSelect(),
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * PATCH /users/me. A customer's phone is changed only through a code sent
   * to the new number (POST /auth/me/phone): a typed number proves nothing,
   * and an OTP sign-in to it would open this account. Staff edit their own
   * phone freely — they never sign in by phone code.
   */
  /**
   * "Delete my account" in the customer app (decided 2026-10-16; required by
   * the App Store and Google Play). The account is deactivated and its
   * personal data removed — name, phone, e-mail, password, photo — while the
   * contract and payment records it is part of stay, under an anonymous
   * name. Refused while the customer has a live contract or an open
   * reservation: those still need them reachable.
   */
  async deleteSelf(caller: { sub: string; role: UserRole }) {
    if (caller.role !== UserRole.CLIENT && caller.role !== UserRole.CUSTOMER) {
      throw new BadRequestException('Staff accounts are removed by an admin');
    }
    const companyId = getRequiredCompanyId();
    const id = caller.sub;
    const user = await this.prisma.user.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true, phone: true, avatarUrl: true },
    });
    if (!user) throw new NotFoundException('User not found');
    await this.assertNoLiveContract(id, companyId);
    const openReservations = await this.prisma.reservation.count({
      where: {
        companyId,
        deletedAt: null,
        status: { in: [ReservationStatus.PENDING, ReservationStatus.APPROVED] },
        OR: [{ clientId: id }, { lead: { is: { clientId: id } } }],
      },
    });
    if (openReservations > 0) {
      throw new ConflictException({
        message: 'لديك حجز قائم — تواصل مع الشركة لإلغائه أولاً',
        code: 'CUSTOMER_HAS_OPEN_RESERVATION',
      });
    }
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          fullName: 'عميل محذوف',
          email: null,
          phone: null,
          pendingPhone: null,
          passwordHash: null,
          avatarUrl: null,
          notificationPrefs: Prisma.DbNull,
          emailVerifiedAt: null,
          phoneVerifiedAt: null,
          active: false,
          deletedAt: now,
        },
      });
      await this.cutAccess(tx, id, companyId);
      if (user.phone) await tx.otpCode.deleteMany({ where: { phone: user.phone, companyId } });
      await tx.auditLog.create({
        data: { actorId: id, action: 'user.self-deleted', entityType: 'User', entityId: id, companyId },
      });
    });
    if (user.avatarUrl) {
      this.r2
        .delete(this.r2.keyFromPublicUrl(user.avatarUrl))
        .catch((err) => this.logger.warn(`avatar cleanup failed for ${id}: ${(err as Error).message}`));
    }
    return { deleted: true };
  }

  async updateSelf(caller: { sub: string; role: UserRole }, dto: UpdateUserDto) {
    if (dto.phone !== undefined && (caller.role === UserRole.CLIENT || caller.role === UserRole.CUSTOMER)) {
      const companyId = getRequiredCompanyId();
      const stored = (await this.prisma.user.findFirst({ where: { id: caller.sub, companyId }, select: { phone: true } }))
        ?.phone;
      const unchanged =
        dto.phone === stored || (dto.phone !== null && (await phoneForWrite(this.prisma, dto.phone, companyId)) === stored);
      if (!unchanged) {
        throw new BadRequestException({
          code: 'PHONE_CHANGE_NEEDS_CODE',
          message: 'تغيير رقم الجوال يتم برمز يُرسل إلى الرقم الجديد',
        });
      }
    }
    return this.update(caller.sub, dto);
  }

  async update(id: string, dto: UpdateUserDto) {
    const companyId = getRequiredCompanyId(); // MT-006
    await this.assertExists(id, companyId);
    // FG-21 — PATCH /users/me is how a customer adds a phone; storing it as
    // typed is what left them unreachable by OTP. Normalise before the
    // synthetic-peer claim so it matches on the stored form too.
    // An unchanged phone is not a write: edit forms resend every field, and a
    // phone stored before FG-21 may not parse. Only a changed value is checked.
    const stored =
      dto.phone === undefined
        ? undefined
        : (await this.prisma.user.findFirst({ where: { id, companyId }, select: { phone: true } }))?.phone;
    const phone =
      dto.phone !== undefined && dto.phone === stored
        ? dto.phone
        : await phoneForWrite(this.prisma, dto.phone, companyId);
    // A typed phone proves nothing, so a profile edit never pulls CRM records
    // in (it did before: adding a lead's number took over its reservations).
    // A changed phone loses its verification until the next OTP sign-in, which
    // proves it and links the records. A number held by a CRM record still
    // hits the unique constraint, which the controller maps to a clear error.
    const phoneChanged = phone !== undefined && phone !== stored;
    const { birthDate: _b, nationalIdIssueDate: _i, customFields: _c, ...plain } = dto;
    return this.prisma.user.update({
      where: { id },
      data: {
        ...plain,
        ...(await this.recordData(dto, companyId, id)),
        ...(phone !== undefined ? { phone } : {}),
        ...(phoneChanged ? { phoneVerifiedAt: null } : {}),
      },
      select: this.publicSelect(),
    });
  }

  async deactivate(id: string) {
    const companyId = getRequiredCompanyId(); // MT-007
    await this.assertExists(id, companyId);
    await this.assertNoLiveContract(id, companyId);
    // Told first, while the account can still receive it.
    try {
      await this.notifications.sendToUser(id, 'user_account_suspended', {
        entityType: 'user',
        entityId: id,
      });
    } catch {
      // best-effort — deactivation must not fail due to notification errors
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { active: false },
        select: this.publicSelect(),
      });
      await this.cutAccess(tx, id, companyId);
      return updated;
    });
  }

  /**
   * Hands everything still open of a departing sales person to a colleague in
   * one step: open leads, upcoming visits/appointments and live reservations.
   * Closed work (won/lost leads, contracts, past visits) keeps its history.
   * Returns how many of each moved.
   */
  async offboard(id: string, toUserId: string, actorId: string) {
    const companyId = getRequiredCompanyId();
    const from = await this.prisma.user.findFirst({ where: { id, companyId }, select: { id: true } });
    if (!from) throw new NotFoundException('User not found');
    if (toUserId === id) throw new BadRequestException('اختر موظفاً آخر لاستلام العمل');
    const to = await assertAssignableSales(this.prisma, toUserId);

    const moved = await this.prisma.$transaction(async (tx) => {
      const leads = await tx.lead.updateMany({
        where: { assignedSalesId: id, companyId, stage: { notIn: [LeadStage.WON, LeadStage.LOST] } },
        data: { assignedSalesId: to.id },
      });
      const visits = await tx.visitRequest.updateMany({
        where: {
          assignedSalesId: id,
          companyId,
          status: { in: [VisitStatus.PENDING, VisitStatus.APPROVED, VisitStatus.SCHEDULED] },
        },
        data: { assignedSalesId: to.id },
      });
      const appointments = await tx.visitAppointment.updateMany({
        where: {
          assignedSalesId: id,
          companyId,
          status: {
            in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING_RESCHEDULE],
          },
        },
        data: { assignedSalesId: to.id },
      });
      const reservations = await tx.reservation.updateMany({
        where: {
          salesId: id,
          companyId,
          deletedAt: null,
          status: { in: [ReservationStatus.PENDING, ReservationStatus.APPROVED] },
        },
        data: { salesId: to.id },
      });
      const counts = {
        leads: leads.count,
        visits: visits.count,
        appointments: appointments.count,
        reservations: reservations.count,
      };
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'user.offboarded',
          entityType: 'User',
          entityId: id,
          after: { toUserId: to.id, ...counts },
          companyId,
        },
      });
      return counts;
    });
    return { toUserId: to.id, ...moved };
  }

  /**
   * Someone who leaves keeps nothing that reaches them or acts for them:
   * sessions are revoked (a reactivation used to revive every 30-day refresh
   * token), the phone stops receiving pushes with customer names, and a
   * manager's team is no longer tied to an account nobody reads.
   */
  private async cutAccess(tx: Prisma.TransactionClient, id: string, companyId: string) {
    await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.deviceToken.deleteMany({ where: { userId: id } });
    await tx.user.updateMany({ where: { managerId: id, companyId }, data: { managerId: null } });
    // Maintenance work assigned to them goes back to the queue — it used to
    // sit on an account nobody can open until the SLA breach fired. Work in
    // progress too: unassigned but still IN_PROGRESS, nobody picked it up. A
    // resolved request waiting on the customer is unassigned, so a colleague
    // follows up the confirmation or a complaint.
    await tx.maintenanceRequest.updateMany({
      where: {
        assignedAdminId: id,
        companyId,
        status: { in: [MaintenanceStatus.ASSIGNED, MaintenanceStatus.IN_PROGRESS] },
      },
      data: { assignedAdminId: null, status: MaintenanceStatus.OPEN },
    });
    await tx.maintenanceRequest.updateMany({
      where: { assignedAdminId: id, companyId, status: MaintenanceStatus.RESOLVED },
      data: { assignedAdminId: null },
    });
  }

  async activate(id: string) {
    const companyId = getRequiredCompanyId(); // MT-008
    await this.assertExists(id, companyId);
    const updated = await this.prisma.user.update({
      where: { id },
      data: { active: true },
      select: this.publicSelect(),
    });
    try {
      await this.notifications.sendToUser(id, 'user_account_approved', {
        entityType: 'user',
        entityId: id,
      });
    } catch {
      // best-effort — activation must not fail due to notification errors
    }
    return updated;
  }

  /**
   * Replace the signed-in user's avatar: validate the image, stream it to
   * object storage, persist the new public URL, and best-effort delete the
   * previous object so old avatars don't pile up in the bucket.
   */
  async updateAvatar(id: string, file: UploadedImage | undefined) {
    if (!file) throw new BadRequestException('No file uploaded');
    const ext = AVATAR_MIME[file.mimetype];
    if (!ext) {
      throw new BadRequestException('Unsupported image type — use JPG, PNG, or WEBP');
    }
    if (file.size > AVATAR_MAX_BYTES) {
      throw new BadRequestException('Image too large — max 5 MB');
    }

    const current = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, avatarUrl: true },
    });
    if (!current) throw new NotFoundException('User not found');

    const { publicUrl } = await this.r2.uploadObject({
      buffer: file.buffer,
      contentType: file.mimetype,
      folder: 'avatars',
      extension: ext,
    });

    const updated = await this.prisma.user.update({
      where: { id },
      data: { avatarUrl: publicUrl },
      select: this.publicSelect(),
    });

    // Best-effort cleanup of the prior object — never fail the request on it.
    if (current.avatarUrl && current.avatarUrl !== publicUrl) {
      this.r2
        .delete(this.r2.keyFromPublicUrl(current.avatarUrl))
        .catch((err) =>
          this.logger.warn(`avatar cleanup failed for ${id}: ${(err as Error).message}`),
        );
    }

    return updated;
  }

  async softDelete(id: string) {
    const companyId = getRequiredCompanyId(); // MT-009
    await this.assertExists(id, companyId);
    await this.assertNoLiveContract(id, companyId);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { deletedAt: new Date(), active: false },
        select: this.publicSelect(),
      });
      await this.cutAccess(tx, id, companyId);
      return updated;
    });
  }

  /**
   * A customer with a live contract keeps their account: deactivating or
   * deleting it cut them off from their schedule and receipts while the
   * contract went on charging (overdue notices, late fees). Cancel or
   * transfer the contract first.
   */
  private async assertNoLiveContract(id: string, companyId: string) {
    const live = await this.prisma.contract.count({ where: { customerId: id, companyId, ...LIVE_CONTRACT_WHERE } });
    if (live > 0) {
      throw new ConflictException({
        message: 'لهذا العميل عقد ساري — ألغِ العقد أو تنازل عنه أولاً',
        code: 'CUSTOMER_HAS_LIVE_CONTRACT',
      });
    }
  }

  async restore(id: string) {
    const companyId = getRequiredCompanyId(); // MT-009
    const user = await this.prisma.user.findFirst({
      where: { id, companyId },
      select: { id: true, deletedAt: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.deletedAt === null) throw new BadRequestException('User is not deleted');
    // Restored as it was before the delete: able to sign in again.
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: null, active: true },
      select: this.publicSelect(),
    });
  }

  /**
   * The customer-record fields of a create or edit as stored: days as dates,
   * and the company's own fields merged into what the customer holds and
   * checked against the company's definitions. Only the fields sent.
   */
  private async recordData(dto: CustomerRecordDto, companyId: string, userId: string | null) {
    const today = new Date().toISOString().slice(0, 10);
    const day = (v: string | null | undefined, label: string) => {
      if (v === undefined || v === null) return v;
      const d = new Date(`${v}T00:00:00Z`);
      if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v || v < '1900-01-01' || v > today) {
        throw new BadRequestException(`${label} غير صالح`);
      }
      return d;
    };
    const data: Pick<Prisma.UserUncheckedCreateInput, (typeof CUSTOMER_RECORD_KEYS)[number]> = {};
    for (const k of ['nationalId', 'address', 'birthPlace', 'occupation', 'employer', 'nationalIdIssuePlace', 'homePhone'] as const) {
      if (dto[k] !== undefined) data[k] = dto[k];
    }
    if (dto.birthDate !== undefined) data.birthDate = day(dto.birthDate, 'تاريخ الميلاد');
    if (dto.nationalIdIssueDate !== undefined) data.nationalIdIssueDate = day(dto.nationalIdIssueDate, 'تاريخ إصدار الهوية');
    if (dto.customFields !== undefined) {
      const [fields, current] = await Promise.all([
        this.prisma.customerField.findMany({
          where: { companyId },
          select: { key: true, type: true, options: true, active: true, label: true },
        }),
        userId
          ? this.prisma.user.findFirst({ where: { id: userId, companyId }, select: { customFields: true } })
          : null,
      ]);
      data.customFields = mergeCustomValues(fields, current?.customFields ?? null, dto.customFields);
    }
    return data;
  }

  private publicSelect() {
    return {
      id: true,
      role: true,
      fullName: true,
      email: true,
      phone: true,
      nationalId: true,
      address: true,
      birthDate: true,
      birthPlace: true,
      occupation: true,
      employer: true,
      nationalIdIssueDate: true,
      nationalIdIssuePlace: true,
      homePhone: true,
      customFields: true,
      locale: true,
      active: true,
      avatarUrl: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
      deletedAt: true,
      managerId: true,
      manager: { select: { id: true, fullName: true } },
    } as const;
  }

  // MT-003: companyId is now required — all callers pass getRequiredCompanyId().
  // findFirst is used instead of findUnique because User has no compound unique
  // constraint on (id, companyId); findUnique would fail at compile time.
  private async assertExists(id: string, companyId: string) {
    const exists = await this.prisma.user.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('User not found');
  }
}
