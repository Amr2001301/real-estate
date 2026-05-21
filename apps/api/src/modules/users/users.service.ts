import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { Prisma, UserRole } from '@prisma/client';
import { paginate, takeSkip } from '../../common/utils/pagination';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    if (
      (dto.role === 'ADMIN' || dto.role === 'SALES' || dto.role === 'SALES_MANAGER') &&
      !dto.password
    ) {
      throw new BadRequestException('Password required for staff roles');
    }
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Either email or phone is required');
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
    return this.prisma.user.update({
      where: { id },
      data: { ...dto },
      select: this.publicSelect(),
    });
  }

  async deactivate(id: string) {
    await this.assertExists(id);
    return this.prisma.user.update({
      where: { id },
      data: { active: false },
      select: this.publicSelect(),
    });
  }

  async activate(id: string) {
    await this.assertExists(id);
    return this.prisma.user.update({
      where: { id },
      data: { active: true },
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
