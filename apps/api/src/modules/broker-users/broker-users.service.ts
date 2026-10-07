import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getTenantContext } from '../../common/tenant/tenant-context';
import { phoneForWrite } from '../../common/utils/phone-for-write';
import {
  CreateBrokerUserDto,
  UpdateBrokerUserDto,
  UpdateBrokerUserStatusDto,
} from './dto/broker-user.dto';

const BROKER_USER_INCLUDE = {
  user: {
    select: {
      id: true,
      role: true,
      fullName: true,
      email: true,
      phone: true,
      locale: true,
      active: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} as const;

@Injectable()
export class BrokerUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listByBroker(brokerId: string) {
    await this.assertBrokerExists(brokerId);
    return this.prisma.brokerUser.findMany({
      where: { brokerId },
      orderBy: [{ isPrimaryContact: 'desc' }, { createdAt: 'asc' }],
      include: BROKER_USER_INCLUDE,
    });
  }

  async create(brokerId: string, dto: CreateBrokerUserDto) {
    const { companyId } = await this.assertBrokerExists(brokerId);

    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Either email or phone is required');
    }

    // Find an existing user by email or phone (each is @unique on User).
    // FG-21 — normalise before the clash lookup and the write, so the lookup
    // sees `01…` and `+201…` as the same person.
    const phone = await phoneForWrite(this.prisma, dto.phone, getTenantContext()?.companyId);

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          ...(dto.email ? [{ email: dto.email }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
    });

    if (existingUser && existingUser.role !== UserRole.BROKER) {
      throw new ConflictException(
        `A user with this ${existingUser.email === dto.email ? 'email' : 'phone'} ` +
          `already exists with role ${existingUser.role}. Refusing to silently convert to BROKER.`,
      );
    }

    // FG-24 — a broker's users belong to the broker's company. User email and
    // phone are still globally unique, so the lookup above can return another
    // company's user; attaching it would hand this company a foreign account.
    if (existingUser?.companyId && existingUser.companyId !== companyId) {
      throw new ConflictException('This user belongs to another company');
    }

    if (existingUser) {
      const link = await this.prisma.brokerUser.findUnique({
        where: { userId: existingUser.id },
        select: { id: true, brokerId: true },
      });
      if (link) {
        throw new ConflictException(
          link.brokerId === brokerId
            ? 'This user is already attached to this broker'
            : 'This user is already attached to another broker',
        );
      }
    }

    const passwordHash = dto.password ? await argon2.hash(dto.password) : null;
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimaryContact) {
        await tx.brokerUser.updateMany({
          where: { brokerId, isPrimaryContact: true },
          data: { isPrimaryContact: false },
        });
      }

      // FG-24 — User is TENANT_CONTROLLED: nothing injects companyId, so it is
      // set here. Without it the account is invisible to every tenant-scoped
      // query, cannot use the tenant staff login, and escapes the company
      // lifecycle check on token refresh.
      const user = existingUser
        ? existingUser.companyId
          ? existingUser
          : await tx.user.update({ where: { id: existingUser.id }, data: { companyId } })
        : await tx.user.create({
            data: {
              role: UserRole.BROKER,
              fullName: dto.fullName,
              email: dto.email ?? null,
              phone: phone ?? null,
              passwordHash,
              locale: dto.locale ?? 'ar',
              companyId,
            },
          });

      return tx.brokerUser.create({
        data: {
          userId: user.id,
          brokerId,
          jobTitle: dto.jobTitle ?? null,
          isPrimaryContact: dto.isPrimaryContact ?? false,
          canManageBrokerUsers: dto.canManageBrokerUsers ?? false,
          canViewCommissions: dto.canViewCommissions ?? true,
          invitedAt: now,
          status: 'INVITED',
        },
        include: BROKER_USER_INCLUDE,
      });
    });
  }

  async update(brokerUserId: string, dto: UpdateBrokerUserDto) {
    const link = await this.assertBrokerUserExists(brokerUserId);

    // If email/phone changes, ensure they don't collide with another user.
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
    // An unchanged phone is not a write: edit forms resend every field, and a
    // phone stored before FG-21 may not parse. Only a changed value is checked.
    const phone =
      dto.phone === link.user.phone
        ? dto.phone
        : await phoneForWrite(this.prisma, dto.phone, getTenantContext()?.companyId);
    if (phone !== undefined && phone !== link.user.phone) {
      if (phone) {
        const clash = await this.prisma.user.findUnique({
          where: { phone },
          select: { id: true },
        });
        if (clash && clash.id !== link.userId) {
          throw new ConflictException(`Phone "${phone}" is already in use`);
        }
      }
    }

    const userData: Prisma.UserUpdateInput = {};
    if (dto.fullName !== undefined) userData.fullName = dto.fullName;
    if (dto.email !== undefined) userData.email = dto.email;
    if (phone !== undefined) userData.phone = phone;
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
      // Toggling primary contact must demote any other primary on this broker first.
      if (dto.isPrimaryContact === true) {
        await tx.brokerUser.updateMany({
          where: {
            brokerId: link.brokerId,
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
        include: BROKER_USER_INCLUDE,
      });
    });
  }

  async updateStatus(brokerUserId: string, dto: UpdateBrokerUserStatusDto) {
    const link = await this.assertBrokerUserExists(brokerUserId);

    const data: Prisma.BrokerUserUpdateInput = { status: dto.status };
    if (dto.status === 'ACTIVE' && !link.joinedAt) {
      data.joinedAt = new Date();
    }

    return this.prisma.brokerUser.update({
      where: { id: brokerUserId },
      data,
      include: BROKER_USER_INCLUDE,
    });
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private async assertBrokerExists(brokerId: string) {
    const broker = await this.prisma.broker.findUnique({
      where: { id: brokerId },
      select: { id: true, status: true, companyId: true },
    });
    if (!broker) throw new NotFoundException('Broker not found');
    return broker;
  }

  private async assertBrokerUserExists(brokerUserId: string) {
    const link = await this.prisma.brokerUser.findUnique({
      where: { id: brokerUserId },
      include: BROKER_USER_INCLUDE,
    });
    if (!link) throw new NotFoundException('Broker user not found');
    return link;
  }
}
