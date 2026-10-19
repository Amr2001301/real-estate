import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../common/prisma/prisma.service';
import { runAsPlatform } from '../../common/tenant/tenant-context';
import { PERMISSION_CATALOG } from './permission-catalog';

type BootstrapDb = Pick<PrismaService, 'permission' | 'user'>;

/** Write the catalog codes the database is missing; existing rows are kept. */
export async function syncPermissionCatalog(db: BootstrapDb): Promise<number> {
  const res = await db.permission.createMany({
    data: PERMISSION_CATALOG.map((p) => ({ code: p.code, description: p.description })),
    skipDuplicates: true,
  });
  return res.count;
}

/**
 * Create the platform owner from SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD
 * when the platform has none. Production had no way to get the first one but
 * an insert by hand (F1). Never touches an existing SUPER_ADMIN, so the env
 * can stay set: changing it later does not reset anyone's password.
 */
export async function bootstrapSuperAdmin(
  db: BootstrapDb,
  env: Record<string, string | undefined> = process.env,
): Promise<'created' | 'exists' | 'not-configured'> {
  const email = env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.SUPER_ADMIN_PASSWORD;
  if (!email || !password) return 'not-configured';
  if (password.length < 12) {
    throw new Error('SUPER_ADMIN_PASSWORD must be at least 12 characters');
  }
  const existing = await db.user.findFirst({
    where: { role: UserRole.SUPER_ADMIN, deletedAt: null },
    select: { id: true },
  });
  if (existing) return 'exists';
  await db.user.create({
    data: {
      role: UserRole.SUPER_ADMIN,
      email,
      passwordHash: await argon2.hash(password),
      fullName: env.SUPER_ADMIN_NAME?.trim() || 'Platform owner',
      locale: 'ar',
      // MT-027: the platform owner belongs to no company.
      companyId: null,
    },
  });
  return 'created';
}

@Injectable()
export class PermissionCatalogBootstrap implements OnApplicationBootstrap {
  private readonly logger = new Logger(PermissionCatalogBootstrap.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    // No request here: both rows are platform-level (Permission is global, the
    // SUPER_ADMIN has companyId null), so the work runs outside any tenant.
    await runAsPlatform(async () => {
      const added = await syncPermissionCatalog(this.prisma);
      if (added > 0) this.logger.log(`Permission catalog: added ${added} code(s)`);
      const admin = await bootstrapSuperAdmin(this.prisma);
      if (admin === 'created') this.logger.log('Created the platform owner (SUPER_ADMIN_EMAIL)');
    });
  }
}
