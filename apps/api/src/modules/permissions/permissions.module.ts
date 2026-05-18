import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';

/**
 * Lightweight, ADMIN-only management surface for the existing
 * `Permission` and `UserPermission` tables. The codes are seeded by
 * apps/api/prisma/seed.ts; this module lets an admin attach/detach codes
 * to a specific user.
 *
 * Important: as of Phase 16, NO route in the codebase reads
 * UserPermission to enforce access. Role-based guards (@Roles) are still
 * the only enforcement layer. Permissions are *assignable* and stored,
 * but the runtime does not yet honour them. See phase-16 report §F.
 */

class PatchUserPermissionsDto {
  @IsOptional() @IsArray() @IsString({ each: true }) addPermissionCodes?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) removePermissionCodes?: string[];
}

@Injectable()
class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── List all permission codes + user count ───────────────────────────

  async list() {
    // groupBy with _count of related rows requires a join; do it in two
    // round-trips to keep the query simple.
    const [permissions, counts] = await this.prisma.$transaction([
      this.prisma.permission.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.userPermission.groupBy({
        by: ['permissionId'],
        _count: { userId: true },
        orderBy: { permissionId: 'asc' },
      }),
    ]);
    const countMap = new Map<string, number>();
    for (const c of counts) {
      const n =
        c._count && typeof c._count === 'object' && 'userId' in c._count
          ? (c._count as { userId?: number }).userId ?? 0
          : 0;
      countMap.set(c.permissionId, n);
    }
    return permissions.map((p) => ({
      id: p.id,
      code: p.code,
      description: p.description,
      userCount: countMap.get(p.id) ?? 0,
    }));
  }

  // ── User's permissions ──────────────────────────────────────────────

  async listForUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        active: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const [assignedRows, allPermissions] = await this.prisma.$transaction([
      this.prisma.userPermission.findMany({
        where: { userId },
        include: { permission: true },
        orderBy: { permission: { code: 'asc' } },
      }),
      this.prisma.permission.findMany({ orderBy: { code: 'asc' } }),
    ]);

    const assignedCodes = new Set(assignedRows.map((r) => r.permission.code));
    const assigned = assignedRows.map((r) => ({
      id: r.permission.id,
      code: r.permission.code,
      description: r.permission.description,
    }));
    const available = allPermissions
      .filter((p) => !assignedCodes.has(p.code))
      .map((p) => ({ id: p.id, code: p.code, description: p.description }));

    return { user, assigned, available };
  }

  // ── Apply diff to a user's permissions ──────────────────────────────

  async updateForUser(userId: string, dto: PatchUserPermissionsDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const addCodes = (dto.addPermissionCodes ?? []).filter(Boolean);
    const removeCodes = (dto.removePermissionCodes ?? []).filter(Boolean);

    if (addCodes.length === 0 && removeCodes.length === 0) {
      // Nothing to do — return the current state so the caller has the
      // canonical response shape.
      return this.listForUser(userId);
    }

    // Resolve every code in one round-trip so we can fail-fast on a typo
    // rather than partially apply.
    const wantedCodes = Array.from(new Set([...addCodes, ...removeCodes]));
    const found = await this.prisma.permission.findMany({
      where: { code: { in: wantedCodes } },
      select: { id: true, code: true },
    });
    const codeToId = new Map(found.map((p) => [p.code, p.id]));
    const missing = wantedCodes.filter((c) => !codeToId.has(c));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Unknown permission code(s): ${missing.join(', ')}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      if (addCodes.length > 0) {
        // The composite PK (userId, permissionId) makes createMany with
        // skipDuplicates the idempotent way to assign.
        await tx.userPermission.createMany({
          data: addCodes.map((code) => ({
            userId,
            permissionId: codeToId.get(code)!,
          })),
          skipDuplicates: true,
        });
      }
      if (removeCodes.length > 0) {
        await tx.userPermission.deleteMany({
          where: {
            userId,
            permissionId: { in: removeCodes.map((c) => codeToId.get(c)!) },
          },
        });
      }
    });

    return this.listForUser(userId);
  }
}

@ApiTags('permissions')
@Controller()
class PermissionsController {
  constructor(private readonly svc: PermissionsService) {}

  @Roles(UserRole.ADMIN)
  @Get('permissions')
  list() {
    return this.svc.list();
  }

  @Roles(UserRole.ADMIN)
  @Get('users/:id/permissions')
  listForUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.listForUser(id);
  }

  @Roles(UserRole.ADMIN)
  @Patch('users/:id/permissions')
  updateForUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchUserPermissionsDto,
  ) {
    return this.svc.updateForUser(id, dto);
  }
}

@Module({
  controllers: [PermissionsController],
  providers: [PermissionsService],
})
export class PermissionsModule {}
