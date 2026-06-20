import { BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UsersService } from '../users.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * SALES_MANAGER team assignment (Batch 9).
 *
 * managerId may only reference a SALES_MANAGER user. Assignment is exercised
 * via UsersService.assignManager (ADMIN-only at the controller layer) and is
 * also validated on create.
 */
const SALES_ID = 'b0000000-0000-4000-8000-000000000002';
const MANAGER_ID = 'd0000000-0000-4000-8000-000000000004';
const NON_MANAGER_ID = 'a0000000-0000-4000-8000-000000000001'; // an ADMIN

function makeService() {
  const findUnique = jest.fn().mockImplementation(async ({ where, select }) => {
    // assertExists uses select { id }; assertIsManager uses select { role }.
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
  const prisma = { user: { findUnique, update, create } } as unknown as PrismaService;
  return { service: new UsersService(prisma, {} as never, {} as never), findUnique, update, create };
}

describe('Users · SALES_MANAGER team assignment', () => {
  it('assigns a SALES rep to a SALES_MANAGER', async () => {
    const { service, update } = makeService();
    const res = await service.assignManager(SALES_ID, MANAGER_ID);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0]![0].data.managerId).toBe(MANAGER_ID);
    expect(res.managerId).toBe(MANAGER_ID);
  });

  it('rejects a managerId that is not a SALES_MANAGER', async () => {
    const { service, update } = makeService();
    await expect(service.assignManager(SALES_ID, NON_MANAGER_ID)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('clears the manager when managerId is null', async () => {
    const { service, update } = makeService();
    const res = await service.assignManager(SALES_ID, null);
    expect(update.mock.calls[0]![0].data.managerId).toBeNull();
    expect(res.managerId).toBeNull();
  });

  it('create rejects a managerId that is not a SALES_MANAGER', async () => {
    const { service, create } = makeService();
    await expect(
      service.create({
        role: UserRole.SALES,
        fullName: 'Rep',
        email: 'r@example.com',
        password: 'SalesPass123!',
        managerId: NON_MANAGER_ID,
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });
});
