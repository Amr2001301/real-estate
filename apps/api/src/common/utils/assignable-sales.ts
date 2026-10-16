import { BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { findTenantUser } from '../tenant/resolve-tenant-entity';

/** Roles that can own leads, visits and reservations. */
export const SALES_OWNER_ROLES: UserRole[] = [UserRole.SALES, UserRole.SALES_MANAGER, UserRole.ADMIN];

/**
 * The user work is being handed to must be an active, non-deleted sales
 * person in this company — leads used to be assignable to anyone, including
 * a deactivated rep or an id from another tenant.
 */
export async function assertAssignableSales(
  prisma: PrismaService,
  userId: string,
  roles: UserRole[] = SALES_OWNER_ROLES,
): Promise<{ id: string; fullName: string; role: UserRole }> {
  const user = await findTenantUser(prisma, userId, {
    id: true,
    fullName: true,
    role: true,
    active: true,
    deletedAt: true,
  });
  if (!user || user.active === false || user.deletedAt || !roles.includes(user.role)) {
    throw new BadRequestException('لا يمكن التحويل لهذا المستخدم — يجب أن يكون موظف مبيعات نشطاً');
  }
  return { id: user.id, fullName: user.fullName, role: user.role };
}
