import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { BrokerUserStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { paginate, takeSkip } from '../../common/utils/pagination';
import type { BrokerScopeContext } from '../../common/guards/broker-scope.guard';
import {
  CreatePortalTeamMemberDto,
  PortalTeamQueryDto,
  UpdatePortalTeamMemberDto,
  UpdatePortalTeamMemberStatusDto,
} from './dto/portal-team.dto';

const TEAM_INCLUDE = {
  user: {
    select: {
      id: true,
      role: true,
      fullName: true,
      email: true,
      phone: true,
      locale: true,
      lastLoginAt: true,
      createdAt: true,
    },
  },
} as const;

/**
 * Manages a broker firm's own team from the broker portal. All operations are
 * pinned to `scope.brokerId` — managers cannot reach into another firm.
 *
 * Mirrors the admin BrokerUsersService where the rules are identical (one
 * primary contact per broker, no hard delete, etc.) but adds the
 * scope-pinning, "last manager" and "self-removal" guards that admin doesn't
 * need.
 */
@Injectable()
export class BrokerPortalTeamService {
  constructor(private readonly prisma: PrismaService) {}

  // ── List ────────────────────────────────────────────────────────────────

  async list(scope: BrokerScopeContext, query: PortalTeamQueryDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 50, 100);

    const where: Prisma.BrokerUserWhereInput = {
      brokerId: scope.brokerId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            user: {
              OR: [
                { fullName: { contains: query.q, mode: 'insensitive' } },
                { email: { contains: query.q, mode: 'insensitive' } },
                { phone: { contains: query.q } },
              ],
            },
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.brokerUser.count({ where }),
      this.prisma.brokerUser.findMany({
        where,
        orderBy: [{ isPrimaryContact: 'desc' }, { createdAt: 'asc' }],
        include: TEAM_INCLUDE,
        ...takeSkip({ page, pageSize }),
      }),
    ]);

    return paginate(rows, total, { page, pageSize });
  }

  // ── Fetch one ───────────────────────────────────────────────────────────

  async findOne(scope: BrokerScopeContext, brokerUserId: string) {
    const row = await this.scopedFindOrThrow(scope, brokerUserId);
    return row;
  }

  // ── Create ──────────────────────────────────────────────────────────────

  async create(scope: BrokerScopeContext, dto: CreatePortalTeamMemberDto) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Either email or phone is required');
    }

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          ...(dto.email ? [{ email: dto.email }] : []),
          ...(dto.phone ? [{ phone: dto.phone }] : []),
        ],
      },
    });

    if (existingUser && existingUser.role !== UserRole.BROKER) {
      throw new ConflictException(
        `A user with this ${existingUser.email === dto.email ? 'email' : 'phone'} ` +
          `already exists with role ${existingUser.role}. Refusing to silently convert to BROKER.`,
      );
    }

    if (existingUser) {
      const link = await this.prisma.brokerUser.findUnique({
        where: { userId: existingUser.id },
        select: { id: true, brokerId: true },
      });
      if (link) {
        throw new ConflictException(
          link.brokerId === scope.brokerId
            ? 'هذا المستخدم منضم بالفعل لفريقكم'
            : 'هذا المستخدم منضم بالفعل لشركة وساطة أخرى',
        );
      }
    }

    const passwordHash = dto.password ? await argon2.hash(dto.password) : null;
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimaryContact) {
        await tx.brokerUser.updateMany({
          where: { brokerId: scope.brokerId, isPrimaryContact: true },
          data: { isPrimaryContact: false },
        });
      }

      const user =
        existingUser ??
        (await tx.user.create({
          data: {
            role: UserRole.BROKER,
            fullName: dto.fullName,
            email: dto.email ?? null,
            phone: dto.phone ?? null,
            passwordHash,
            locale: dto.locale ?? 'ar',
          },
        }));

      return tx.brokerUser.create({
        data: {
          userId: user.id,
          brokerId: scope.brokerId,
          jobTitle: dto.jobTitle ?? null,
          isPrimaryContact: dto.isPrimaryContact ?? false,
          canManageBrokerUsers: dto.canManageBrokerUsers ?? false,
          canViewCommissions: dto.canViewCommissions ?? true,
          invitedAt: now,
          status: BrokerUserStatus.INVITED,
        },
        include: TEAM_INCLUDE,
      });
    });
  }

  // ── Update fields ───────────────────────────────────────────────────────

  async update(
    scope: BrokerScopeContext,
    brokerUserId: string,
    dto: UpdatePortalTeamMemberDto,
  ) {
    const link = await this.scopedFindOrThrow(scope, brokerUserId);

    // Email/phone collision check against User table.
    if (dto.email !== undefined && dto.email !== link.user.email) {
      if (dto.email) {
        const clash = await this.prisma.user.findUnique({
          where: { email: dto.email },
          select: { id: true },
        });
        if (clash && clash.id !== link.userId) {
          throw new ConflictException(`Email "${dto.email}" is already in use`);
        }
      }
    }
    if (dto.phone !== undefined && dto.phone !== link.user.phone) {
      if (dto.phone) {
        const clash = await this.prisma.user.findUnique({
          where: { phone: dto.phone },
          select: { id: true },
        });
        if (clash && clash.id !== link.userId) {
          throw new ConflictException(`Phone "${dto.phone}" is already in use`);
        }
      }
    }

    // "Last manager" guard: if this update would drop the firm to zero
    // managers (no primary contact + no canManageBrokerUsers across the
    // remaining ACTIVE users), block it.
    const willHaveManagement = await this.simulateManagement(scope.brokerId, [
      {
        brokerUserId,
        isPrimaryContact:
          dto.isPrimaryContact !== undefined ? dto.isPrimaryContact : link.isPrimaryContact,
        canManageBrokerUsers:
          dto.canManageBrokerUsers !== undefined
            ? dto.canManageBrokerUsers
            : link.canManageBrokerUsers,
        status: link.status,
      },
    ]);
    if (!willHaveManagement) {
      throw new BadRequestException(
        'لا يمكن إزالة آخر مدير نشط للوسيط — قم بترقية عضو آخر أولاً',
      );
    }

    const userData: Prisma.UserUpdateInput = {};
    if (dto.fullName !== undefined) userData.fullName = dto.fullName;
    if (dto.email !== undefined) userData.email = dto.email;
    if (dto.phone !== undefined) userData.phone = dto.phone;
    if (dto.locale !== undefined) userData.locale = dto.locale;

    const linkData: Prisma.BrokerUserUpdateInput = {};
    if (dto.jobTitle !== undefined) linkData.jobTitle = dto.jobTitle;
    if (dto.canManageBrokerUsers !== undefined) {
      linkData.canManageBrokerUsers = dto.canManageBrokerUsers;
    }
    if (dto.canViewCommissions !== undefined) {
      linkData.canViewCommissions = dto.canViewCommissions;
    }
    if (dto.isPrimaryContact !== undefined) {
      linkData.isPrimaryContact = dto.isPrimaryContact;
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimaryContact === true) {
        await tx.brokerUser.updateMany({
          where: {
            brokerId: scope.brokerId,
            isPrimaryContact: true,
            NOT: { id: brokerUserId },
          },
          data: { isPrimaryContact: false },
        });
      }
      if (Object.keys(userData).length > 0) {
        await tx.user.update({ where: { id: link.userId }, data: userData });
      }
      return tx.brokerUser.update({
        where: { id: brokerUserId },
        data: linkData,
        include: TEAM_INCLUDE,
      });
    });
  }

  // ── Update status ───────────────────────────────────────────────────────

  async updateStatus(
    scope: BrokerScopeContext,
    brokerUserId: string,
    dto: UpdatePortalTeamMemberStatusDto,
  ) {
    const link = await this.scopedFindOrThrow(scope, brokerUserId);

    // Self-deactivation guard: a manager cannot suspend or remove their own
    // row from inside the portal. Admin can still do this from /dashboard.
    const isSelf = link.id === scope.brokerUserId;
    if (isSelf && dto.status !== BrokerUserStatus.ACTIVE) {
      throw new BadRequestException(
        'لا يمكنك تعطيل أو إزالة حسابك الخاص من البوابة. تواصل مع المدير العام.',
      );
    }

    // "Last active broker user" guard — never drop to zero ACTIVE rows.
    if (
      link.status === BrokerUserStatus.ACTIVE &&
      dto.status !== BrokerUserStatus.ACTIVE
    ) {
      const otherActive = await this.prisma.brokerUser.count({
        where: {
          brokerId: scope.brokerId,
          status: BrokerUserStatus.ACTIVE,
          NOT: { id: brokerUserId },
        },
      });
      if (otherActive === 0) {
        throw new BadRequestException(
          'لا يمكن إزالة آخر عضو نشط في فريق الوسيط',
        );
      }
    }

    // "Last manager" guard for status transitions that take a manager out of
    // ACTIVE while their flags would still mark them as a manager. We
    // simulate the post-update state.
    if (
      link.status === BrokerUserStatus.ACTIVE &&
      dto.status !== BrokerUserStatus.ACTIVE &&
      (link.isPrimaryContact || link.canManageBrokerUsers)
    ) {
      const willHaveManagement = await this.simulateManagement(scope.brokerId, [
        {
          brokerUserId,
          isPrimaryContact: link.isPrimaryContact,
          canManageBrokerUsers: link.canManageBrokerUsers,
          status: dto.status,
        },
      ]);
      if (!willHaveManagement) {
        throw new BadRequestException(
          'لا يمكن إزالة آخر مدير نشط للوسيط — قم بترقية عضو آخر أولاً',
        );
      }
    }

    const data: Prisma.BrokerUserUpdateInput = { status: dto.status };
    if (dto.status === BrokerUserStatus.ACTIVE && !link.joinedAt) {
      data.joinedAt = new Date();
    }
    return this.prisma.brokerUser.update({
      where: { id: brokerUserId },
      data,
      include: TEAM_INCLUDE,
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  /** Loads a broker user but only if it belongs to the caller's firm. */
  private async scopedFindOrThrow(scope: BrokerScopeContext, brokerUserId: string) {
    const row = await this.prisma.brokerUser.findUnique({
      where: { id: brokerUserId },
      include: TEAM_INCLUDE,
    });
    if (!row || row.brokerId !== scope.brokerId) {
      // Same response for "not found" and "not yours" — don't leak existence.
      throw new NotFoundException('Broker user not found');
    }
    return row;
  }

  /**
   * Returns true iff after applying the proposed overrides the broker firm
   * still has at least one ACTIVE broker user who is either primary contact
   * or `canManageBrokerUsers`. Used by both `update` and `updateStatus` so
   * the rule is enforced consistently.
   */
  private async simulateManagement(
    brokerId: string,
    overrides: Array<{
      brokerUserId: string;
      isPrimaryContact: boolean;
      canManageBrokerUsers: boolean;
      status: BrokerUserStatus;
    }>,
  ): Promise<boolean> {
    const rows = await this.prisma.brokerUser.findMany({
      where: { brokerId },
      select: {
        id: true,
        status: true,
        isPrimaryContact: true,
        canManageBrokerUsers: true,
      },
    });
    const byId = new Map(rows.map((r) => [r.id, { ...r }]));
    for (const o of overrides) {
      byId.set(o.brokerUserId, {
        id: o.brokerUserId,
        status: o.status,
        isPrimaryContact: o.isPrimaryContact,
        canManageBrokerUsers: o.canManageBrokerUsers,
      });
    }
    for (const r of byId.values()) {
      if (r.status === BrokerUserStatus.ACTIVE && (r.isPrimaryContact || r.canManageBrokerUsers)) {
        return true;
      }
    }
    return false;
  }
}
