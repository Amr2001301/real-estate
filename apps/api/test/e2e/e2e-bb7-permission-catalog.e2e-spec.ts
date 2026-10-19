/**
 * BB7 — F1. The permission codes lived only in the demo seed, so a production
 * database had no catalog (and 6 codes the controllers check were missing
 * from it anyway), and the first SUPER_ADMIN could only be inserted by hand.
 * The API now writes the missing codes at startup, and creates the platform
 * owner from SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD when there is none.
 */
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import { PrismaClient, UserRole } from '@prisma/client';
import { PrismaModule } from '../../src/common/prisma/prisma.module';
import { PermissionCatalogBootstrap } from '../../src/modules/permissions/permission-catalog.bootstrap';
import { PERMISSION_CATALOG } from '../../src/modules/permissions/permission-catalog';

describe('BB7 — permission catalog and platform owner at startup (e2e)', () => {
  const raw = new PrismaClient();
  const code = 'users:restore';
  let holders: string[] = [];

  const boot = async (): Promise<INestApplication> => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [PermissionCatalogBootstrap],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    return app;
  };

  afterAll(async () => {
    // Give the code back to whoever held it before the test removed it.
    const permission = await raw.permission.findUnique({ where: { code } });
    if (permission && holders.length) {
      await raw.userPermission.createMany({
        data: holders.map((userId) => ({ userId, permissionId: permission.id })),
        skipDuplicates: true,
      });
    }
    await raw.$disconnect();
  });

  it('BB7-1: a code missing from the database is written when the API starts', async () => {
    const before = await raw.permission.findUnique({ where: { code } });
    if (before) {
      holders = (
        await raw.userPermission.findMany({
          where: { permissionId: before.id },
          select: { userId: true },
        })
      ).map((r) => r.userId);
      await raw.userPermission.deleteMany({ where: { permissionId: before.id } });
      await raw.permission.delete({ where: { id: before.id } });
    }

    const app = await boot();
    try {
      expect(await raw.permission.findUnique({ where: { code } })).not.toBeNull();
      const codes = new Set(
        (await raw.permission.findMany({ select: { code: true } })).map((p) => p.code),
      );
      expect(PERMISSION_CATALOG.filter((p) => !codes.has(p.code))).toEqual([]);
    } finally {
      await app.close();
    }
  });

  it('BB7-2: an existing platform owner is left alone', async () => {
    const owners = () => raw.user.count({ where: { role: UserRole.SUPER_ADMIN, deletedAt: null } });
    const count = await owners();
    expect(count).toBeGreaterThan(0);
    process.env.SUPER_ADMIN_EMAIL = `bb7-owner-${Date.now()}@example.com`;
    process.env.SUPER_ADMIN_PASSWORD = 'Bb7OwnerPass123!';
    const app = await boot();
    try {
      expect(await owners()).toBe(count);
      expect(await raw.user.count({ where: { email: process.env.SUPER_ADMIN_EMAIL } })).toBe(0);
    } finally {
      delete process.env.SUPER_ADMIN_EMAIL;
      delete process.env.SUPER_ADMIN_PASSWORD;
      await app.close();
    }
  });
});
