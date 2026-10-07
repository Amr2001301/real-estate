import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../common/prisma/prisma.service';
import { phoneForWrite } from '../../common/utils/phone-for-write';
import { claimSyntheticPeers } from '../../common/utils/identity-claim';
import { getRequiredCompanyId } from '../../common/tenant/tenant-context';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { Prisma, UserRole } from '@prisma/client';
import { paginate, takeSkip, toCounts } from '../../common/utils/pagination';
import { R2Service } from '../media/r2.service';
import { NotificationsService } from '../notifications/notifications.module';
import { PlanLimitService } from '../../common/capabilities/plan-limit.service';

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
  ) {}

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
    return this.prisma.user.create({
      data: {
        role: dto.role,
        fullName: dto.fullName,
        email: dto.email ?? null,
        phone: phone ?? null,
        passwordHash,
        locale: dto.locale ?? 'ar',
        managerId: dto.managerId ?? null,
        companyId,
      },
      select: this.publicSelect(),
    });
  }

  // ADMIN-only manager assignment. null clears it. A non-null managerId must
  // reference an existing SALES_MANAGER user within the same company.
  async assignManager(id: string, managerId: string | null) {
    const companyId = getRequiredCompanyId();
    await this.assertExists(id, companyId);
    if (managerId) await this.assertIsManager(managerId, companyId);
    return this.prisma.user.update({
      where: { id },
      data: { managerId: managerId ?? null },
      select: this.publicSelect(),
    });
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
    // P9 — when a user (typically self via PATCH /v1/users/me) adds a phone
    // that overlaps with a synthetic peer (a CRM-only CLIENT row carrying
    // their pre-registration Leads / Reservations), sweep the peer into the
    // registered account BEFORE the update writes the new value — otherwise
    // the unique-phone constraint on User.phone would block the write.
    // Idempotent: re-runs after a successful merge are no-ops. Safe inside
    // an admin-driven edit too — only CLIENT rows with passwordHash=null
    // are eligible.
    if (phone) {
      try {
        const result = await claimSyntheticPeers(this.prisma, id, {
          phone,
        });
        if (result.claimedCount > 0) {
          this.logger.log(
            `[identity-claim] profile-update pre-claim merged ${result.claimedCount} synthetic peer(s) into ${id}: ${result.claimedIds.join(', ')}`,
          );
        }
      } catch (err) {
        // Never block the customer's profile edit on a CRM-housekeeping
        // failure; the next login will try again. If the synthetic survives
        // and still holds the same phone, the user.update below will surface
        // the unique-constraint violation — the caller (controller) maps it
        // to a user-friendly error rather than a 500.
        this.logger.warn(
          `[identity-claim] profile-update pre-claim errored for ${id}: ${(err as Error).message}`,
        );
      }
    }
    return this.prisma.user.update({
      where: { id },
      data: { ...dto, ...(phone !== undefined ? { phone } : {}) },
      select: this.publicSelect(),
    });
  }

  async deactivate(id: string) {
    const companyId = getRequiredCompanyId(); // MT-007
    await this.assertExists(id, companyId);
    const updated = await this.prisma.user.update({
      where: { id },
      data: { active: false },
      select: this.publicSelect(),
    });
    try {
      await this.notifications.sendToUser(id, 'user_account_suspended', {
        entityType: 'user',
        entityId: id,
      });
    } catch {
      // best-effort — deactivation must not fail due to notification errors
    }
    return updated;
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
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
      select: this.publicSelect(),
    });
  }

  async restore(id: string) {
    const companyId = getRequiredCompanyId(); // MT-009
    const user = await this.prisma.user.findFirst({
      where: { id, companyId },
      select: { id: true, deletedAt: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.deletedAt === null) throw new BadRequestException('User is not deleted');
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: null },
      select: this.publicSelect(),
    });
  }

  private publicSelect() {
    return {
      id: true,
      role: true,
      fullName: true,
      email: true,
      phone: true,
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
