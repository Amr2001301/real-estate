import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../common/prisma/prisma.service';
import { claimSyntheticPeers } from '../../common/utils/identity-claim';
import { getTenantContext } from '../../common/tenant/tenant-context';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { Prisma, UserRole } from '@prisma/client';
import { paginate, takeSkip } from '../../common/utils/pagination';
import { R2Service } from '../media/r2.service';
import { NotificationsService } from '../notifications/notifications.module';

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

    // Enforce plan user limit — only applies inside a tenant context (company admin).
    // Super-admin bypass context skips this check intentionally.
    const tenantCtx = getTenantContext();
    if (tenantCtx && !tenantCtx.bypass && tenantCtx.companyId) {
      const company = await this.prisma.company.findUnique({
        where: { id: tenantCtx.companyId },
        select: { maxUsers: true, _count: { select: { users: true } } },
      });
      if (company?.maxUsers != null && company._count.users >= company.maxUsers) {
        throw new ForbiddenException(
          `لقد وصلت إلى الحد الأقصى للمستخدمين (${company.maxUsers}) في باقتك الحالية. يرجى الترقية للإضافة المزيد.`,
        );
      }
    }

    if (dto.managerId) await this.assertIsManager(dto.managerId);
    const passwordHash = dto.password ? await argon2.hash(dto.password) : null;
    return this.prisma.user.create({
      data: {
        role: dto.role,
        fullName: dto.fullName,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        passwordHash,
        locale: dto.locale ?? 'ar',
        managerId: dto.managerId ?? null,
      },
      select: this.publicSelect(),
    });
  }

  // ADMIN-only manager assignment. null clears it. A non-null managerId must
  // reference an existing SALES_MANAGER user.
  async assignManager(id: string, managerId: string | null) {
    await this.assertExists(id);
    if (managerId) await this.assertIsManager(managerId);
    return this.prisma.user.update({
      where: { id },
      data: { managerId: managerId ?? null },
      select: this.publicSelect(),
    });
  }

  private async assertIsManager(managerId: string) {
    const mgr = await this.prisma.user.findUnique({
      where: { id: managerId },
      select: { role: true },
    });
    if (!mgr || mgr.role !== UserRole.SALES_MANAGER) {
      throw new BadRequestException('managerId must reference a SALES_MANAGER user');
    }
  }

  async findAll(role?: string, page = 1, pageSize = 20, q?: string) {
    const trimmed = q?.trim();
    // `role` may be a single role or a comma-separated list (e.g.
    // "SALES,SALES_MANAGER") for sales-actor dropdowns. Backward compatible.
    const roles = role
      ? (role.split(',').map((r) => r.trim()).filter(Boolean) as UserRole[])
      : [];
    const roleFilter: Prisma.UserWhereInput =
      roles.length > 1 ? { role: { in: roles } } : roles.length === 1 ? { role: roles[0] } : {};
    const where: Prisma.UserWhereInput = {
      ...roleFilter,
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
    return paginate(data, total, { page, pageSize });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: this.publicSelect(),
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.assertExists(id);
    // P9 — when a user (typically self via PATCH /v1/users/me) adds a phone
    // that overlaps with a synthetic peer (a CRM-only CLIENT row carrying
    // their pre-registration Leads / Reservations), sweep the peer into the
    // registered account BEFORE the update writes the new value — otherwise
    // the unique-phone constraint on User.phone would block the write.
    // Idempotent: re-runs after a successful merge are no-ops. Safe inside
    // an admin-driven edit too — only CLIENT rows with passwordHash=null
    // are eligible.
    if (dto.phone !== undefined && dto.phone !== null) {
      try {
        const result = await claimSyntheticPeers(this.prisma, id, {
          phone: dto.phone,
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
      data: { ...dto },
      select: this.publicSelect(),
    });
  }

  async deactivate(id: string) {
    await this.assertExists(id);
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
    await this.assertExists(id);
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
      managerId: true,
      manager: { select: { id: true, fullName: true } },
    } as const;
  }

  private async assertExists(id: string) {
    const exists = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('User not found');
  }
}
