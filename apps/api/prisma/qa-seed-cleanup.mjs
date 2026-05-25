/**
 * Cleanup for the Phase 4.1b QA fixture (qa-seed.mjs).
 * Removes the QA CUSTOMER and all its QA records. Local/dev only.
 * Run from apps/api:  node --env-file=.env prisma/qa-seed-cleanup.mjs
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const EMAIL = 'qa.customer@example.com';

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!/@localhost[:/]|@127\.0\.0\.1[:/]/.test(url)) throw new Error('Refusing: DATABASE_URL is not localhost.');

  const customer = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!customer) {
    console.log('No QA customer found — nothing to clean.');
    return;
  }
  const cid = customer.id;
  const contracts = await prisma.contract.findMany({ where: { customerId: cid }, select: { id: true } });
  const contractIds = contracts.map((c) => c.id);
  const maint = await prisma.maintenanceRequest.findMany({ where: { customerId: cid }, select: { id: true } });
  const maintIds = maint.map((m) => m.id);

  await prisma.notification.deleteMany({ where: { userId: cid } });
  if (maintIds.length) {
    await prisma.document.deleteMany({ where: { ownerType: 'MAINTENANCE_REQUEST', ownerId: { in: maintIds } } });
    await prisma.maintenanceRequest.deleteMany({ where: { id: { in: maintIds } } });
  }
  if (contractIds.length) {
    await prisma.deposit.deleteMany({ where: { contractId: { in: contractIds } } });
    await prisma.installmentPlan.deleteMany({ where: { contractId: { in: contractIds } } });
    await prisma.contract.deleteMany({ where: { id: { in: contractIds } } });
  }
  await prisma.user.delete({ where: { id: cid } });
  console.log(`Cleaned QA customer ${EMAIL} and ${contractIds.length} contract(s), ${maintIds.length} maintenance request(s).`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
