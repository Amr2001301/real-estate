/**
 * The platform's first account: one SUPER_ADMIN, no company, nothing else.
 * Everything after it (companies, their admins, projects…) is created through
 * the product, as a real onboarding would. Used to start a clean QA run
 * (docs/QA_PLAN.md, phase 0) and to bootstrap a new platform.
 *
 *   PLATFORM_ADMIN_EMAIL=… PLATFORM_ADMIN_PASSWORD=… pnpm prisma:seed:platform
 *
 * The password is read from the environment and never stored. Refuses
 * production unless ALLOW_SEED_IN_PRODUCTION=true.
 */
import { PrismaClient, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED_IN_PRODUCTION !== 'true') {
    throw new Error('Seed blocked: NODE_ENV=production. Set ALLOW_SEED_IN_PRODUCTION=true to override.');
  }
  const email = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.PLATFORM_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD are required.');
  if (password.length < 12) throw new Error('PLATFORM_ADMIN_PASSWORD must be at least 12 characters.');
  const fullName = process.env.PLATFORM_ADMIN_NAME ?? 'Platform Owner';
  const passwordHash = await argon2.hash(password);
  // A SUPER_ADMIN belongs to no company (loginSuperAdmin requires companyId = null).
  const existing = await prisma.user.findFirst({ where: { email, role: UserRole.SUPER_ADMIN }, select: { id: true } });
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { passwordHash, fullName } });
    console.log(`Updated the platform account ${email}`);
  } else {
    await prisma.user.create({ data: { email, passwordHash, fullName, role: UserRole.SUPER_ADMIN, locale: 'en', companyId: null } });
    console.log(`Created the platform account ${email}`);
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
