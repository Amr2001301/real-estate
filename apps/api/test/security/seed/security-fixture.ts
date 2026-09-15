/**
 * Security test fixture — creates two isolated tenants (A, B) plus a BROKER
 * company with the minimum data required to execute the attack-matrix tests.
 *
 * Idempotent: a pre-clean pass removes any leftover rows from a prior run
 * before inserting fresh data.
 *
 * Uses rawPrisma (plain PrismaClient, no middleware) so setup is NOT subject
 * to tenant scoping — that's intentional; the tests themselves run via the
 * middleware-wired app.
 */

import type { PrismaClient } from '@prisma/client';
import { UserRole, DocumentVisibility, DocumentOwnerType, DocumentCategory, CompanyType, BrokerStatus, BrokerUserStatus, AppointmentStatus, MaintenanceStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { runTenantContext } from '../../../src/common/tenant/tenant-context';

// ── stable slugs / emails ────────────────────────────────────────────────────

export const SEC_SLUG_A = 'sec-co-a';
export const SEC_SLUG_B = 'sec-co-b';
export const SEC_SLUG_BROKER = 'sec-co-broker';

const PASSWORD = 'SecTest-1234!';

const emails = {
  adminA: 'sec-admin-a@sec.test',
  sales1A: 'sec-sales-a1@sec.test',
  sales2A: 'sec-sales-a2@sec.test',
  smA: 'sec-sm-a@sec.test',
  clientA: 'sec-client-a@sec.test',
  customerA: 'sec-customer-a@sec.test',
  brokerUserA: 'sec-broker-a@sec.test',
  adminB: 'sec-admin-b@sec.test',
  sales1B: 'sec-sales-b1@sec.test',
  sales2B: 'sec-sales-b2@sec.test',
  smB: 'sec-sm-b@sec.test',
  clientB: 'sec-client-b@sec.test',
  customerB: 'sec-customer-b@sec.test',
  brokerUserB: 'sec-broker-b@sec.test',
  legacyClient: 'sec-legacy-client@sec.test',
  brokerAdmin: 'sec-broker-admin@sec.test',
};

export interface SecurityFixture {
  companies: {
    aId: string;
    bId: string;
    brokerId: string;
  };
  users: {
    adminA: { id: string; email: string; password: string };
    sales1A: { id: string; email: string; password: string };
    sales2A: { id: string; email: string; password: string };
    smA: { id: string; email: string; password: string };
    clientA: { id: string; email: string; password: string };
    customerA: { id: string; email: string; password: string };
    brokerUserA: { id: string; email: string; password: string };
    adminB: { id: string; email: string; password: string };
    clientB: { id: string; email: string; password: string };
    customerB: { id: string; email: string; password: string };
    legacyClient: { id: string; email: string };
  };
  resources: {
    a: {
      projectId: string;
      phaseId: string;
      buildingId: string;
      unit1Id: string;
      unit2Id: string;
      unit3Id: string;
      leadId: string;
      reservationId: string;
      contractId: string;
      installmentPlanId: string;
      depositId: string;
      documentId: string;
      chatSessionId: string;
      chatAnonId: string;
      brokerId: string;
      brokerUserId: string;
      visitAppointmentId: string;
      maintenanceCategoryId: string;
      maintenanceRequestId: string;
      notificationTemplateCode: string;
    };
    b: {
      unit1Id: string;
      leadId: string;
      notificationTemplateCode: string;
    };
  };
}

// ── teardown ─────────────────────────────────────────────────────────────────

async function teardownCompany(raw: PrismaClient, companyId: string): Promise<void> {
  // Delete in FK dependency order.  All these are companyId-scoped.
  await raw.notificationTemplate.deleteMany({ where: { companyId } });
  await raw.visitActivity.deleteMany({ where: { companyId } });
  await raw.visitAppointment.deleteMany({ where: { companyId } });
  await raw.maintenanceRequestItem.deleteMany({ where: { companyId } });
  await raw.maintenanceRequest.deleteMany({ where: { companyId } });
  await raw.maintenanceCategory.deleteMany({ where: { companyId } });
  await raw.chatMessage.deleteMany({ where: { companyId } });
  await raw.chatFeedback.deleteMany({ where: { companyId } });
  await raw.chatSession.deleteMany({ where: { companyId } });
  await raw.brokerActivityLog.deleteMany({ where: { companyId } });
  await raw.brokerCommission.deleteMany({ where: { companyId } });
  await raw.brokerPayout.deleteMany({ where: { companyId } });
  await raw.brokerUser.deleteMany({ where: { companyId } });
  const brokerIds = (await raw.broker.findMany({ where: { companyId }, select: { id: true } })).map((b) => b.id);
  if (brokerIds.length > 0) {
    await raw.brokerProjectAccess.deleteMany({ where: { brokerId: { in: brokerIds } } }).catch(() => void 0);
    await raw.brokerUnitAccess.deleteMany({ where: { brokerId: { in: brokerIds } } }).catch(() => void 0);
  }
  await raw.broker.deleteMany({ where: { companyId } });
  // Step A: PaymentInstrument.recordedById → User (RESTRICT); must clear before users.
  // PaymentInstrument.replacedById self-FK is SET NULL so order within the table is safe.
  // Step C: PaymentCorrection.depositId → Deposit (RESTRICT); must clear before deposits.
  await raw.paymentCorrection.deleteMany({ where: { companyId } });
  await raw.paymentInstrument.deleteMany({ where: { companyId } });
  await raw.deposit.deleteMany({ where: { companyId } });
  await raw.installment.deleteMany({ where: { companyId } });
  await raw.installmentPlan.deleteMany({ where: { companyId } });
  await raw.document.deleteMany({ where: { companyId } });
  await raw.contract.deleteMany({ where: { companyId } });
  await raw.reservationNote.deleteMany({ where: { companyId } });
  await raw.reservationActivity.deleteMany({ where: { companyId } });
  await raw.reservation.deleteMany({ where: { companyId } });
  await raw.leadNote.deleteMany({ where: { companyId } });
  await raw.leadActivity.deleteMany({ where: { companyId } });
  await raw.lead.deleteMany({ where: { companyId } });
  await raw.unit.deleteMany({ where: { companyId } });
  await raw.building.deleteMany({ where: { companyId } });
  await raw.phase.deleteMany({ where: { companyId } });
  await raw.project.deleteMany({ where: { companyId } });
  await raw.userPermission.deleteMany({ where: { user: { companyId } } });
  await raw.refreshToken.deleteMany({ where: { user: { companyId } } });
  await raw.user.deleteMany({ where: { companyId } });
  // Legacy user with null companyId identified by email
  await raw.user.deleteMany({ where: { email: emails.legacyClient } });
}

async function teardownCompanies(raw: PrismaClient): Promise<void> {
  // Tear down in A-first order: A may have reservations with clientId pointing to
  // B's users (F1 vulnerability test). Deleting A first removes those cross-company
  // FK references before B's users are deleted.
  for (const slug of [SEC_SLUG_A, SEC_SLUG_B, SEC_SLUG_BROKER]) {
    const co = await raw.company.findFirst({ where: { slug } });
    if (!co) continue;
    // Nullify any nullable FK references from OTHER companies into this company's
    // users before deleting them — handles cross-company artifacts from F1 tests.
    const userIds = await raw.user
      .findMany({ where: { companyId: co.id }, select: { id: true } })
      .then((us) => us.map((u) => u.id));
    if (userIds.length > 0) {
      // Reservation.clientId is nullable
      await raw.reservation.updateMany({
        where: { clientId: { in: userIds } },
        data: { clientId: null },
      });
    }
    await teardownCompany(raw, co.id);
    await raw.company.delete({ where: { id: co.id } });
  }
  // Legacy client has null companyId so is not caught by companyId scope
  await raw.user.deleteMany({ where: { email: emails.legacyClient } });
}

// ── seed ─────────────────────────────────────────────────────────────────────

export async function seedSecurityFixture(raw: PrismaClient): Promise<SecurityFixture> {
  // Pre-clean any leftover data
  await teardownCompanies(raw);

  const hash = await argon2.hash(PASSWORD);

  // ── Companies ──────────────────────────────────────────────────────────────

  const [companyA, companyB, companyBroker] = await Promise.all([
    raw.company.create({ data: { name: 'Sec Company A', slug: SEC_SLUG_A, isActive: true } }),
    raw.company.create({ data: { name: 'Sec Company B', slug: SEC_SLUG_B, isActive: true } }),
    raw.company.create({
      data: { name: 'Sec Broker Co', slug: SEC_SLUG_BROKER, isActive: true, type: CompanyType.BROKERAGE },
    }),
  ]);

  // ── Users — Company A ─────────────────────────────────────────────────────

  const [adminA, sales1A, sales2A, smA, clientA, customerA, brokerUserA] = await Promise.all([
    raw.user.create({ data: { email: emails.adminA, passwordHash: hash, fullName: 'Admin A', role: UserRole.ADMIN, active: true, companyId: companyA.id } }),
    raw.user.create({ data: { email: emails.sales1A, passwordHash: hash, fullName: 'Sales A1', role: UserRole.SALES, active: true, companyId: companyA.id } }),
    raw.user.create({ data: { email: emails.sales2A, passwordHash: hash, fullName: 'Sales A2', role: UserRole.SALES, active: true, companyId: companyA.id } }),
    raw.user.create({ data: { email: emails.smA, passwordHash: hash, fullName: 'SM A', role: UserRole.SALES_MANAGER, active: true, companyId: companyA.id } }),
    raw.user.create({ data: { email: emails.clientA, passwordHash: hash, fullName: 'Client A', role: UserRole.CLIENT, active: true, companyId: companyA.id } }),
    raw.user.create({ data: { email: emails.customerA, passwordHash: hash, fullName: 'Customer A', role: UserRole.CUSTOMER, active: true, companyId: companyA.id } }),
    raw.user.create({ data: { email: emails.brokerUserA, passwordHash: hash, fullName: 'Broker A', role: UserRole.BROKER, active: true, companyId: companyA.id } }),
  ]);

  // ── Users — Company B ─────────────────────────────────────────────────────

  const [adminB, , , , clientB, customerB] = await Promise.all([
    raw.user.create({ data: { email: emails.adminB, passwordHash: hash, fullName: 'Admin B', role: UserRole.ADMIN, active: true, companyId: companyB.id } }),
    raw.user.create({ data: { email: emails.sales1B, passwordHash: hash, fullName: 'Sales B1', role: UserRole.SALES, active: true, companyId: companyB.id } }),
    raw.user.create({ data: { email: emails.sales2B, passwordHash: hash, fullName: 'Sales B2', role: UserRole.SALES, active: true, companyId: companyB.id } }),
    raw.user.create({ data: { email: emails.smB, passwordHash: hash, fullName: 'SM B', role: UserRole.SALES_MANAGER, active: true, companyId: companyB.id } }),
    raw.user.create({ data: { email: emails.clientB, passwordHash: hash, fullName: 'Client B', role: UserRole.CLIENT, active: true, companyId: companyB.id } }),
    raw.user.create({ data: { email: emails.customerB, passwordHash: hash, fullName: 'Customer B', role: UserRole.CUSTOMER, active: true, companyId: companyB.id } }),
    raw.user.create({ data: { email: emails.brokerUserB, passwordHash: hash, fullName: 'Broker B', role: UserRole.BROKER, active: true, companyId: companyB.id } }),
  ]);

  // ── Legacy CLIENT — companyId = NULL ─────────────────────────────────────

  const legacyClient = await raw.user.create({
    data: {
      email: emails.legacyClient,
      passwordHash: hash,
      fullName: 'Legacy Client',
      role: UserRole.CLIENT,
      active: true,
      companyId: null,
    },
  });

  // ── Resources — Company A ─────────────────────────────────────────────────

  const project = await raw.project.create({
    data: {
      name: { ar: 'مشروع أ', en: 'Project A' },
      description: { ar: 'وصف', en: 'desc' },
      city: 'Cairo',
      lat: 30.0,
      lng: 31.0,
      companyId: companyA.id,
    },
  });

  const phase = await raw.phase.create({
    data: {
      projectId: project.id,
      name: { ar: 'مرحلة 1', en: 'Phase 1' },
      order: 1,
      companyId: companyA.id,
    },
  });

  const building = await raw.building.create({
    data: {
      phaseId: phase.id,
      name: 'Building 1',
      totalFloors: 5,
      order: 1,
      companyId: companyA.id,
    },
  });

  const [unit1A, unit2A, unit3A] = await Promise.all([
    raw.unit.create({
      data: { buildingId: building.id, code: 'SEC-A-U1', type: '2BR', area: 120, price: 1_500_000, companyId: companyA.id },
    }),
    raw.unit.create({
      data: { buildingId: building.id, code: 'SEC-A-U2', type: '3BR', area: 150, price: 2_000_000, companyId: companyA.id },
    }),
    // unit3A is reserved for F1-3 test (salesId cross-company attack) so unit2A
    // remains unaffected even after F1-1 reserves unit2A.
    raw.unit.create({
      data: { buildingId: building.id, code: 'SEC-A-U3', type: '1BR', area: 80, price: 900_000, companyId: companyA.id },
    }),
  ]);

  const lead = await raw.lead.create({
    data: {
      clientId: clientA.id,
      fullName: clientA.fullName,
      phone: '+201001001001',
      assignedSalesId: sales1A.id,
      companyId: companyA.id,
    },
  });

  const reservation = await raw.reservation.create({
    data: {
      unitId: unit1A.id,
      salesId: sales1A.id,
      leadId: lead.id,
      expiresAt: new Date(Date.now() + 72 * 3_600_000),
      companyId: companyA.id,
    },
  });

  const contract = await raw.contract.create({
    data: {
      customerId: customerA.id,
      unitId: unit1A.id,
      reservationId: reservation.id,
      totalAmount: 1_500_000,
      downPayment: 150_000,
      companyId: companyA.id,
    },
  });

  const installmentPlan = await raw.installmentPlan.create({
    data: {
      contractId: contract.id,
      totalMonths: 12,
      monthlyAmount: 112_500,
      startsAt: new Date(Date.now() + 30 * 86_400_000),
      companyId: companyA.id,
    },
  });

  const deposit = await raw.deposit.create({
    data: {
      contractId: contract.id,
      amount: 150_000,
      paidAt: new Date(),
      recordedById: adminA.id,
      companyId: companyA.id,
    },
  });

  const document = await raw.document.create({
    data: {
      ownerType: DocumentOwnerType.CONTRACT,
      ownerId: contract.id,
      category: DocumentCategory.CONTRACT,
      title: 'Contract PDF',
      fileUrl: 'https://example.com/contract.pdf',
      visibility: DocumentVisibility.CUSTOMER_VISIBLE,
      uploadedById: adminA.id,
      companyId: companyA.id,
    },
  });

  const chatAnonId = 'sec-anon-' + companyA.id.slice(0, 8);
  const chatSession = await raw.chatSession.create({
    data: {
      anonymousId: chatAnonId,
      metadata: { name: 'PII Name', phone: '+201002002002', interest: 'Project A' },
      companyId: companyA.id,
    },
  });

  // ── Broker firm + BrokerUser (for A7/A8 tests) ───────────────────────────
  // brokerUserA already has role=BROKER; give them a BrokerUser record so they
  // can authenticate against /v1/portal/*.  No BrokerProjectAccess → project
  // list must return empty (A8: blocked).
  const broker = await raw.broker.create({
    data: {
      companyName: 'Sec Broker Firm',
      code: 'SEC-BRK-A-001',
      status: BrokerStatus.ACTIVE,
      createdById: adminA.id,
      companyId: companyA.id,
    },
  });

  const brokerUser = await raw.brokerUser.create({
    data: {
      userId: brokerUserA.id,
      brokerId: broker.id,
      status: BrokerUserStatus.ACTIVE,
      companyId: companyA.id,
    },
  });

  // ── Visit Appointment — Company A (for V-07 reassign test) ──────────────
  // Walk-in appointment (no visitRequest, no client): requires only projectId + scheduledAt.
  const visitAppointment = await raw.visitAppointment.create({
    data: {
      visitNumber: 'VIS-SEC-001',
      projectId: project.id,
      assignedSalesId: sales1A.id,
      scheduledAt: new Date(Date.now() + 7 * 86_400_000), // 1 week from now
      status: AppointmentStatus.SCHEDULED,
      companyId: companyA.id,
    },
  });

  // ── Maintenance — Company A (for V-12/V-13 tests) ───────────────────────
  const maintenanceCategory = await raw.maintenanceCategory.create({
    data: {
      name: { ar: 'فئة الاختبار', en: 'Test Category' },
      companyId: companyA.id,
    },
  });

  const maintenanceRequest = await raw.maintenanceRequest.create({
    data: {
      customerId: customerA.id,
      unitId: unit1A.id,
      categoryId: maintenanceCategory.id,
      description: 'Security test maintenance request',
      status: MaintenanceStatus.OPEN,
      companyId: companyA.id,
    },
  });

  // ── Permissions for sales users (needed for leads endpoints) ─────────────
  // Fetch permission IDs from the global Permission table (seeded by seed.ts).
  const permCodes = ['leads:read', 'leads:update', 'leads:note', 'leads:advance-stage'];
  const perms = await raw.permission.findMany({ where: { code: { in: permCodes } } });
  if (perms.length > 0) {
    const salesUsers = [sales1A, sales2A];
    for (const su of salesUsers) {
      await raw.userPermission.createMany({
        data: perms.map((p) => ({ userId: su.id, permissionId: p.id })),
        skipDuplicates: true,
      });
    }
  }

  // Grant deposits:reverse to adminA so DC-1 cross-tenant test can reach the service
  // layer (past the @PermissionsStrict gate). The deposit belongs to Company B so the
  // service returns 404 before modifying anything — confirms no 2xx is returned.
  const depositsReversePerm = await raw.permission.findFirst({ where: { code: 'deposits:reverse' } });
  if (depositsReversePerm) {
    await raw.userPermission.create({
      data: { userId: adminA.id, permissionId: depositsReversePerm.id },
    }).catch(() => void 0);
  }

  // Grant broker_leads:approve to adminA so the V-08 test can reach the service
  // layer (past the @PermissionsStrict gate). The lead in the fixture has no
  // brokerId so the service returns 404 "not a broker lead" before the
  // cross-tenant assignedSalesId check — still confirms no 2xx is returned.
  const brokerLeadApprovePerm = await raw.permission.findFirst({ where: { code: 'broker_leads:approve' } });
  if (brokerLeadApprovePerm) {
    await raw.userPermission.create({
      data: { userId: adminA.id, permissionId: brokerLeadApprovePerm.id },
    }).catch(() => void 0); // skip if already exists
  }

  // ── Resources — Company B (minimal — used as cross-tenant attack targets) ──

  const projectB = await raw.project.create({
    data: {
      name: { ar: 'مشروع ب', en: 'Project B' },
      description: { ar: 'وصف', en: 'desc' },
      city: 'Alex',
      lat: 31.0,
      lng: 30.0,
      companyId: companyB.id,
    },
  });

  const phaseB = await raw.phase.create({
    data: { projectId: projectB.id, name: { ar: 'مرحلة 1', en: 'Phase 1' }, order: 1, companyId: companyB.id },
  });

  const buildingB = await raw.building.create({
    data: { phaseId: phaseB.id, name: 'Building B1', totalFloors: 3, order: 1, companyId: companyB.id },
  });

  const unit1B = await raw.unit.create({
    data: { buildingId: buildingB.id, code: 'SEC-B-U1', type: '1BR', area: 80, price: 800_000, companyId: companyB.id },
  });

  const leadB = await raw.lead.create({
    data: {
      clientId: clientB.id,
      fullName: clientB.fullName,
      phone: '+201003003003',
      companyId: companyB.id,
    },
  });

  // ── NotificationTemplate — admin_broadcast passthrough (required by broadcastNotification) ──
  // onModuleInit() fails silently in test environments (no tenant context at startup),
  // so the template must be seeded here. Owned by Company A for the V-19 sanity test.
  // teardownCompany() removes it via deleteMany({ where: { companyId: companyA.id } }).
  await raw.notificationTemplate.deleteMany({ where: { code: 'admin_broadcast' } });
  await raw.notificationTemplate.create({
    data: {
      code: 'admin_broadcast',
      channel: 'IN_APP',
      subject: { ar: '{{title_ar}}', en: '{{title_en}}' },
      body: { ar: '{{body_ar}}', en: '{{body_en}}' },
      active: true,
      companyId: companyA.id,
    },
  });

  // ── NotificationTemplate — Company A (used by V-17 best-effort send test) ──
  const SEC_NOTIF_CODE_A = 'sec-notif-tpl-a';
  await raw.notificationTemplate.create({
    data: {
      code: SEC_NOTIF_CODE_A,
      channel: 'IN_APP',
      subject: { ar: 'عنوان أ', en: 'Title A' },
      body: { ar: 'نص أ', en: 'Body A' },
      active: true,
      companyId: companyA.id,
    },
  });

  // ── NotificationTemplate — Company B (target for cross-tenant overwrite test) ──
  // code has a global @unique constraint; this template is owned by Company B.
  // Company A must not be able to overwrite it via POST /notification-templates.
  const SEC_NOTIF_CODE_B = 'sec-notif-tpl-b';
  await raw.notificationTemplate.create({
    data: {
      code: SEC_NOTIF_CODE_B,
      channel: 'IN_APP',
      subject: { ar: 'عنوان ب', en: 'Title B' },
      body: { ar: 'نص ب', en: 'Body B' },
      active: true,
      companyId: companyB.id,
    },
  });

  return {
    companies: { aId: companyA.id, bId: companyB.id, brokerId: companyBroker.id },
    users: {
      adminA: { id: adminA.id, email: emails.adminA, password: PASSWORD },
      sales1A: { id: sales1A.id, email: emails.sales1A, password: PASSWORD },
      sales2A: { id: sales2A.id, email: emails.sales2A, password: PASSWORD },
      smA: { id: smA.id, email: emails.smA, password: PASSWORD },
      clientA: { id: clientA.id, email: emails.clientA, password: PASSWORD },
      customerA: { id: customerA.id, email: emails.customerA, password: PASSWORD },
      brokerUserA: { id: brokerUserA.id, email: emails.brokerUserA, password: PASSWORD },
      adminB: { id: adminB.id, email: emails.adminB, password: PASSWORD },
      clientB: { id: clientB.id, email: emails.clientB, password: PASSWORD },
      customerB: { id: customerB.id, email: emails.customerB, password: PASSWORD },
      legacyClient: { id: legacyClient.id, email: emails.legacyClient },
    },
    resources: {
      a: {
        projectId: project.id,
        phaseId: phase.id,
        buildingId: building.id,
        unit1Id: unit1A.id,
        unit2Id: unit2A.id,
        unit3Id: unit3A.id,
        leadId: lead.id,
        reservationId: reservation.id,
        contractId: contract.id,
        installmentPlanId: installmentPlan.id,
        depositId: deposit.id,
        documentId: document.id,
        chatSessionId: chatSession.id,
        chatAnonId,
        brokerId: broker.id,
        brokerUserId: brokerUser.id,
        visitAppointmentId: visitAppointment.id,
        maintenanceCategoryId: maintenanceCategory.id,
        maintenanceRequestId: maintenanceRequest.id,
        notificationTemplateCode: SEC_NOTIF_CODE_A,
      },
      b: { unit1Id: unit1B.id, leadId: leadB.id, notificationTemplateCode: SEC_NOTIF_CODE_B },
    },
  };
}

export async function teardownSecurityFixture(raw: PrismaClient): Promise<void> {
  await teardownCompanies(raw);
}

export { PASSWORD as SEC_PASSWORD };
