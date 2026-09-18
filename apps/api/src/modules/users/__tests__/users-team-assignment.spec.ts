import { BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UsersService } from '../users.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { runTenantContext } from '../../../common/tenant/tenant-context';

/**
 * SALES_MANAGER team assignment (Batch 9).
 *
 * managerId may only reference a SALES_MANAGER user within the same company.
 * Assignment is exercised via UsersService.assignManager (ADMIN-only at the
 * controller layer) and is also validated on create.
 */
const SALES_ID = 'b0000000-0000-4000-8000-000000000002';
const MANAGER_ID = 'd0000000-0000-4000-8000-000000000004';
const NON_MANAGER_ID = 'a0000000-0000-4000-8000-000000000001'; // an ADMIN
const TEST_COMPANY_ID = 'test-co-00000000-0000-4000-8000-000000000000';

function makeService() {
  // MT-003/MT-010: assertExists now uses findFirst; assertIsManager uses findFirst.
  const findFirst = jest.fn().mockImplementation(async ({ where }) => {
    if (where.id === MANAGER_ID) return { id: MANAGER_ID, role: UserRole.SALES_MANAGER };
    if (where.id === NON_MANAGER_ID) return { id: NON_MANAGER_ID, role: UserRole.ADMIN };
    if (where.id === SALES_ID) return { id: SALES_ID, role: UserRole.SALES };
    return null;
  });
  const update = jest.fn().mockImplementation(async ({ where, data }) => ({
    id: where.id,
    managerId: data.managerId,
  }));
  const create = jest.fn().mockImplementation(async ({ data }) => ({ id: 'u-new', ...data }));
  const prisma = {
    user: { findFirst, update, create },
    company: {
      findUnique: jest.fn().mockResolvedValue({ maxUsers: null, _count: { users: 0 } }),
    },
  } as unknown as PrismaService;
  const planLimits = { checkUserLimit: jest.fn().mockResolvedValue(undefined) } as never;
  return { service: new UsersService(prisma, {} as never, {} as never, planLimits), findFirst, update, create };
}

function asTenant<T>(fn: () => Promise<T>): Promise<T> {
  return runTenantContext({ companyId: TEST_COMPANY_ID, bypass: false, isPublic: false }, fn);
}

describe('Users · SALES_MANAGER team assignment', () => {
  it('assigns a SALES rep to a SALES_MANAGER', async () => {
    const { service, update } = makeService();
    const res = await asTenant(() => service.assignManager(SALES_ID, MANAGER_ID));
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0]![0].data.managerId).toBe(MANAGER_ID);
    expect(res.managerId).toBe(MANAGER_ID);
  });

  it('rejects a managerId that is not a SALES_MANAGER', async () => {
    const { service, update } = makeService();
    await expect(
      asTenant(() => service.assignManager(SALES_ID, NON_MANAGER_ID)),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('clears the manager when managerId is null', async () => {
    const { service, update } = makeService();
    const res = await asTenant(() => service.assignManager(SALES_ID, null));
    expect(update.mock.calls[0]![0].data.managerId).toBeNull();
    expect(res.managerId).toBeNull();
  });

  it('create rejects a managerId that is not a SALES_MANAGER', async () => {
    const { service, create } = makeService();
    await expect(
      asTenant(() => service.create({
        role: UserRole.SALES,
        fullName: 'Rep',
        email: 'r@example.com',
        password: 'SalesPass123!',
        managerId: NON_MANAGER_ID,
      } as never)),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });
});
