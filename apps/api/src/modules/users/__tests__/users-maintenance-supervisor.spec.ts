import { BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UsersService } from '../users.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * MAINTENANCE_SUPERVISOR role foundation (Batch 10).
 *
 * The supervisor is a staff role for the maintenance mobile app. The users
 * service must treat it like other staff: a password is required on create,
 * and a valid create persists role = MAINTENANCE_SUPERVISOR.
 */
describe('Users · MAINTENANCE_SUPERVISOR role foundation', () => {
  function makeService() {
    const create = jest.fn().mockImplementation(async ({ data }) => ({
      id: 'u-1',
      role: data.role,
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
    }));
    const prisma = { user: { create } } as unknown as PrismaService;
    return { service: new UsersService(prisma, {} as never, {} as never), create };
  }

  it('UserRole enum exposes MAINTENANCE_SUPERVISOR', () => {
    expect(UserRole.MAINTENANCE_SUPERVISOR).toBe('MAINTENANCE_SUPERVISOR');
  });

  it('requires a password for MAINTENANCE_SUPERVISOR (staff role)', async () => {
    const { service, create } = makeService();
    await expect(
      service.create({
        role: UserRole.MAINTENANCE_SUPERVISOR,
        fullName: 'Supervisor',
        email: 's@example.com',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('creates a MAINTENANCE_SUPERVISOR when a password is supplied', async () => {
    const { service, create } = makeService();
    const result = await service.create({
      role: UserRole.MAINTENANCE_SUPERVISOR,
      fullName: 'Supervisor',
      email: 's@example.com',
      password: 'MaintenancePass123!',
    } as never);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]![0].data.role).toBe(UserRole.MAINTENANCE_SUPERVISOR);
    expect(create.mock.calls[0]![0].data.passwordHash).toEqual(expect.any(String));
    expect(result.role).toBe(UserRole.MAINTENANCE_SUPERVISOR);
  });
});
