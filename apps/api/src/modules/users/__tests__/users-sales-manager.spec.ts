import { BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UsersService } from '../users.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { runTenantContext } from '../../../common/tenant/tenant-context';

const TEST_COMPANY_ID = 'test-co-00000000-0000-4000-8000-000000000000';

/**
 * SALES_MANAGER role foundation (Batch 7).
 *
 * The role enum now includes SALES_MANAGER. These tests assert that the users
 * service treats it as a staff role: a password is required (like ADMIN/SALES),
 * and a valid create persists role = SALES_MANAGER. Route-access scoping for the
 * role is intentionally out of scope until Batch 8.
 */
describe('Users · SALES_MANAGER role foundation', () => {
  function makeService() {
    const create = jest.fn().mockImplementation(async ({ data }) => ({
      id: 'u-1',
      role: data.role,
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
    }));
    const prisma = {
      user: { create, findFirst: jest.fn().mockResolvedValue(null) },
      company: {
        findUnique: jest.fn().mockResolvedValue({ maxUsers: null, _count: { users: 0 } }),
      },
    } as unknown as PrismaService;
    const planLimits = { checkUserLimit: jest.fn().mockResolvedValue(undefined) } as never;
    return { service: new UsersService(prisma, {} as never, {} as never, planLimits), create };
  }

  it('UserRole enum exposes SALES_MANAGER', () => {
    expect(UserRole.SALES_MANAGER).toBe('SALES_MANAGER');
  });

  it('requires a password for SALES_MANAGER (staff role)', async () => {
    const { service, create } = makeService();
    // Validation throws before getRequiredCompanyId() — no tenant context needed.
    await expect(
      service.create({ role: UserRole.SALES_MANAGER, fullName: 'Mgr', email: 'm@example.com' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('creates a SALES_MANAGER when a password is supplied', async () => {
    const { service, create } = makeService();
    const result = await runTenantContext(
      { companyId: TEST_COMPANY_ID, bypass: false, isPublic: false },
      () => service.create({
        role: UserRole.SALES_MANAGER,
        fullName: 'Mgr',
        email: 'm@example.com',
        password: 'ManagerPass123!',
      } as never),
    );
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]![0].data.role).toBe(UserRole.SALES_MANAGER);
    expect(create.mock.calls[0]![0].data.passwordHash).toEqual(expect.any(String));
    expect(result.role).toBe(UserRole.SALES_MANAGER);
  });
});
