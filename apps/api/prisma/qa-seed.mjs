/**
 * QA-ONLY local/dev fixture for Phase 4.1b customer-portal live QA.
 * NOT product seed. Creates a clearly-labeled CUSTOMER + minimal records.
 * Idempotent. Run from apps/api:  node --env-file=.env prisma/qa-seed.mjs
 * Cleanup: see prisma/qa-seed-cleanup.mjs
 */
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();
const EMAIL = 'qa.customer@example.com';
const PASSWORD = 'QaCustomer123!';

async function main() {
  // Safety: refuse anything that doesn't look local/dev.
  const url = process.env.DATABASE_URL ?? '';
  if (!/@localhost[:/]|@127\.0\.0\.1[:/]/.test(url)) {
    throw new Error(`Refusing to seed: DATABASE_URL is not localhost (${url.replace(/:[^:@/]+@/, ':***@')})`);
  }

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) throw new Error('No ADMIN user found (needed as deposit.recordedBy).');

  let category = await prisma.maintenanceCategory.findFirst({ where: { active: true } });
  if (!category) {
    category = await prisma.maintenanceCategory.create({
      data: { code: 'qa-general', name: { ar: 'صيانة عامة (QA)', en: 'QA General' }, active: true, priority: 'MEDIUM' },
    });
  }

  // Reuse existing seeded units that carry the building→phase→project chain.
  const candidates = await prisma.unit.findMany({
    take: 10,
    include: { building: { include: { phase: { include: { project: true } } } } },
  });
  const withProject = candidates.filter((u) => u.building?.phase?.project);
  if (withProject.length === 0) throw new Error('No units with a project chain found to attach contracts.');
  const unitA = withProject[0];
  const unitB = withProject[1] ?? withProject[0];

  const passwordHash = await argon2.hash(PASSWORD);
  const customer = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { role: 'CUSTOMER', passwordHash, fullName: 'QA Customer' },
    create: { role: 'CUSTOMER', fullName: 'QA Customer', email: EMAIL, phone: '+966500009999', locale: 'ar', passwordHash },
  });

  // Contracts: one WITH pdfUrl + signed + plan, one WITHOUT (→ "غير متاح بعد" / "غير موقّع").
  const c1 = await prisma.contract.upsert({
    where: { contractNumber: 'QA-C-001' },
    update: { customerId: customer.id, unitId: unitA.id, totalAmount: '1500000', downPayment: '300000', pdfUrl: 'https://example.com/qa/contract-QA-C-001.pdf', signedAt: new Date() },
    create: { contractNumber: 'QA-C-001', customerId: customer.id, unitId: unitA.id, totalAmount: '1500000', downPayment: '300000', pdfUrl: 'https://example.com/qa/contract-QA-C-001.pdf', signedAt: new Date() },
  });
  const c2 = await prisma.contract.upsert({
    where: { contractNumber: 'QA-C-002' },
    update: { customerId: customer.id, unitId: unitB.id, totalAmount: '900000', downPayment: '0', pdfUrl: null, signedAt: null },
    create: { contractNumber: 'QA-C-002', customerId: customer.id, unitId: unitB.id, totalAmount: '900000', downPayment: '0' },
  });

  await prisma.installmentPlan.upsert({
    where: { contractId: c1.id },
    update: { totalMonths: 48, monthlyAmount: '25000', startsAt: new Date(), frequency: 'MONTHLY' },
    create: { contractId: c1.id, totalMonths: 48, monthlyAmount: '25000', startsAt: new Date(), frequency: 'MONTHLY' },
  });

  // Deposits scope via contract.customerId → attach to QA contract c1.
  if ((await prisma.deposit.count({ where: { contractId: c1.id } })) === 0) {
    await prisma.deposit.createMany({
      data: [
        { type: 'DOWN_PAYMENT', contractId: c1.id, amount: '300000', paidAt: new Date(), verified: true, receiptUrl: 'https://example.com/qa/receipt-DP.pdf', recordedById: admin.id },
        { type: 'INSTALLMENT', contractId: c1.id, amount: '25000', paidAt: new Date(), verified: false, recordedById: admin.id },
      ],
    });
  }

  // Maintenance: two statuses; a customer-visible document on the first.
  let m1 = await prisma.maintenanceRequest.findFirst({ where: { customerId: customer.id }, orderBy: { createdAt: 'asc' } });
  if (!m1) {
    m1 = await prisma.maintenanceRequest.create({
      data: { customerId: customer.id, unitId: unitA.id, categoryId: category.id, description: 'QA: تسريب مياه في الحمام الرئيسي', status: 'OPEN', reviewStatus: 'PENDING', priority: 'MEDIUM' },
    });
    await prisma.maintenanceRequest.create({
      data: { customerId: customer.id, unitId: unitA.id, categoryId: category.id, description: 'QA: المكيف لا يبرّد جيدًا', status: 'IN_PROGRESS', reviewStatus: 'APPROVED', priority: 'HIGH' },
    });
    await prisma.document.create({
      data: { ownerType: 'MAINTENANCE_REQUEST', ownerId: m1.id, category: 'IMAGE', title: 'QA: صورة العطل', fileUrl: 'https://example.com/qa/maintenance-photo.jpg', visibility: 'CUSTOMER_VISIBLE', uploadedById: customer.id },
    });
  }

  // Notifications: one known code (unread), one unknown code (read).
  if ((await prisma.notification.count({ where: { userId: customer.id } })) === 0) {
    await prisma.notification.createMany({
      data: [
        { userId: customer.id, templateCode: 'maintenance_request_status_changed', payload: { requestId: m1?.id ?? null }, channel: 'IN_APP', sentAt: new Date(), readAt: null },
        { userId: customer.id, templateCode: 'qa_unknown_code', payload: {}, channel: 'IN_APP', sentAt: new Date(), readAt: new Date() },
      ],
    });
  }

  console.log('QA seed complete:');
  console.log(JSON.stringify({ email: EMAIL, password: PASSWORD, customerId: customer.id, contracts: [c1.id, c2.id], maintenanceDetailId: m1?.id }, null, 2));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
