import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UsersService } from '../users.service';
import { runTenantContext } from '../../../common/tenant/tenant-context';

const COMPANY = '11111111-1111-4111-8111-111111111111';

function make(role: UserRole, limitError?: Error) {
  const update = jest.fn().mockResolvedValue({ id: 'u1' });
  const prisma = {
    user: {
      findFirst: jest.fn().mockResolvedValue({ id: 'u1', deletedAt: new Date(), role }),
      update,
    },
  };
  const checkUserLimit = jest.fn().mockImplementation(() => (limitError ? Promise.reject(limitError) : Promise.resolve()));
  const service = new UsersService(prisma as never, {} as never, {} as never, { checkUserLimit } as never);
  return { service, update, checkUserLimit };
}

const run = <T>(fn: () => Promise<T>) => runTenantContext({ companyId: COMPANY, bypass: false, isPublic: false }, fn);

describe('restoring a deleted user takes a seat again', () => {
  it('is refused when the company is at its staff limit, and nothing is restored', async () => {
    const { service, update, checkUserLimit } = make(UserRole.SALES, new ForbiddenException('User limit reached'));
    await expect(run(() => service.restore('u1'))).rejects.toBeInstanceOf(ForbiddenException);
    expect(checkUserLimit).toHaveBeenCalledWith(UserRole.SALES);
    expect(update).not.toHaveBeenCalled();
  });

  it('restores when a seat is free', async () => {
    const { service, update } = make(UserRole.SALES);
    await run(() => service.restore('u1'));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { deletedAt: null, active: true } }));
  });
});
