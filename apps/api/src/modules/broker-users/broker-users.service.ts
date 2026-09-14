import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
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
    await this.assertBrokerExists(brokerId);

    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Either email or phone is required');
    }

    // Find an existing user by email or phone (each is @unique on User).
    // eslint-disable-next-line no-restricted-syntax -- lookup by email/phone (@unique globally); prevents duplicate-user DB errors across tenants
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
        // eslint-disable-next-line no-restricted-syntax -- email is @unique globally; select: {id} only; no data returned to caller
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
        // eslint-disable-next-line no-restricted-syntax -- phone is @unique globally; select: {id} only; no data returned to caller
        const clash = await this.prisma.user.findUnique({
          where: { phone: dto.phone },
          select: { id: true },
        });
        if (clash && clash.id !== link.userId) {
          throw new ConflictException(`Phone "${dto.phone}" is already in use`);
        }
      }
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
      select: { id: true, status: true },
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
