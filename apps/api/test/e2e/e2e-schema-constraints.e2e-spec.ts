/**
 * B4 — Per-tenant unique constraint verification
 *
 * Proves that the @@unique([companyId, …]) indexes added in
 * 20260926000001_per_tenant_unique_constraints behave correctly:
 *
 *   - Two different companies CAN hold the same value (cross-tenant allowed).
 *   - Two rows within the SAME company cannot share the same value (intra-tenant
 *     duplicate is rejected with Prisma P2002).
 *
 * Covered constraints:
 *   Contract.contractNumber  @@unique([companyId, contractNumber])
 *   Broker.code              @@unique([companyId, code])
 *   Broker.taxId             @@unique([companyId, taxId])
 *   Project.code             @@unique([companyId, code])
 *   Phase.code               @@unique([projectId, code])
 *   Building.name            @@unique([phaseId, name])
 *
 * All operations use rawPrisma (no tenant middleware) so the tests exercise
 * the DB constraints directly, not service-layer checks.
 */

import 'reflect-metadata';
import { createE2ETestApp, type TestApp } from '../setup-app';

const SLUG_A = 'constraint-test-company-a';
const SLUG_B = 'constraint-test-company-b';

async function expectP2002(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
    throw new Error('Expected a P2002 unique constraint violation but the call succeeded');
  } catch (e) {
    if (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002') return;
    throw e;
  }
}

describe('B4 — per-tenant unique constraints', () => {
  let testApp: TestApp;

  let companyAId: string;
  let companyBId: string;

  let unitAId: string;
  let unitBId: string;
  let customerAId: string;
  let customerBId: string;

  let projectAId: string;
  let projectBId: string;
  let phaseAId: string;
  let phaseBId: string;

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    const raw = testApp.rawPrisma;

    for (const slug of [SLUG_A, SLUG_B]) {
      const leftover = await raw.company.findFirst({ where: { slug } });
      if (leftover) {
        await raw.contract.deleteMany({ where: { companyId: leftover.id } });
        await raw.broker.deleteMany({ where: { companyId: leftover.id } });
        await raw.unit.deleteMany({ where: { companyId: leftover.id } });
        await raw.building.deleteMany({ where: { companyId: leftover.id } });
        await raw.phase.deleteMany({ where: { companyId: leftover.id } });
        await raw.project.deleteMany({ where: { companyId: leftover.id } });
        await raw.user.deleteMany({ where: { companyId: leftover.id } });
        await raw.company.delete({ where: { id: leftover.id } });
      }
    }

    const companyA = await raw.company.create({
      data: { name: 'Constraint Test Co A', slug: SLUG_A, isActive: true, country: 'EG' },
    });
    companyAId = companyA.id;

    const companyB = await raw.company.create({
      data: { name: 'Constraint Test Co B', slug: SLUG_B, isActive: true, country: 'EG' },
    });
    companyBId = companyB.id;

    const customerA = await raw.user.create({
      data: {
        fullName: 'Customer A',
        email: `customer-a@${SLUG_A}.local`,
        passwordHash: '$argon2id$v=19$test',
        role: 'CLIENT',
        companyId: companyAId,
      },
    });
    customerAId = customerA.id;

    const customerB = await raw.user.create({
      data: {
        fullName: 'Customer B',
        email: `customer-b@${SLUG_B}.local`,
        passwordHash: '$argon2id$v=19$test',
        role: 'CLIENT',
        companyId: companyBId,
      },
    });
    customerBId = customerB.id;

    const projectA = await raw.project.create({
      data: {
        name: { ar: 'مشروع أ', en: 'Project A' },
        description: { ar: '', en: '' },
        city: 'Cairo',
        lat: 30.0,
        lng: 31.0,
        companyId: companyAId,
      },
    });
    projectAId = projectA.id;

    const projectB = await raw.project.create({
      data: {
        name: { ar: 'مشروع ب', en: 'Project B' },
        description: { ar: '', en: '' },
        city: 'Cairo',
        lat: 30.1,
        lng: 31.1,
        companyId: companyBId,
      },
    });
    projectBId = projectB.id;

    const phaseA = await raw.phase.create({
      data: { projectId: projectAId, name: { ar: 'مرحلة 1', en: 'Phase 1' }, companyId: companyAId },
    });
    phaseAId = phaseA.id;

    const phaseB = await raw.phase.create({
      data: { projectId: projectBId, name: { ar: 'مرحلة 1', en: 'Phase 1' }, companyId: companyBId },
    });
    phaseBId = phaseB.id;

    const buildingA = await raw.building.create({
      data: { phaseId: phaseAId, name: 'Tower A', code: 'TOWER-A', companyId: companyAId },
    });
    const buildingB = await raw.building.create({
      data: { phaseId: phaseBId, name: 'Tower A', code: 'TOWER-A', companyId: companyBId },
    });

    const unitA = await raw.unit.create({
      data: {
        buildingId: buildingA.id,
        code: 'U-001',
        type: '2BR',
        area: 120,
        price: 1_000_000,
        companyId: companyAId,
      },
    });
    unitAId = unitA.id;

    const unitB = await raw.unit.create({
      data: {
        buildingId: buildingB.id,
        code: 'U-001',
        type: '2BR',
        area: 120,
        price: 1_000_000,
        companyId: companyBId,
      },
    });
    unitBId = unitB.id;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    for (const id of [companyAId, companyBId].filter(Boolean)) {
      await raw.contract.deleteMany({ where: { companyId: id } });
      await raw.broker.deleteMany({ where: { companyId: id } });
      await raw.unit.deleteMany({ where: { companyId: id } });
      await raw.building.deleteMany({ where: { companyId: id } });
      await raw.phase.deleteMany({ where: { companyId: id } });
      await raw.project.deleteMany({ where: { companyId: id } });
      await raw.user.deleteMany({ where: { companyId: id } });
    }
    await raw.company.deleteMany({ where: { slug: { in: [SLUG_A, SLUG_B] } } });
    await testApp.close();
  });

  // ── Contract.contractNumber ────────────────────────────────────────────────

  describe('Contract.contractNumber — @@unique([companyId, contractNumber])', () => {
    afterEach(async () => {
      await testApp.rawPrisma.contract.deleteMany({
        where: { companyId: { in: [companyAId, companyBId] } },
      });
    });

    it('two companies can each hold the same contractNumber', async () => {
      const raw = testApp.rawPrisma;
      await raw.contract.create({
        data: {
          contractNumber: 'CON-2026-0001',
          customerId: customerAId,
          unitId: unitAId,
          totalAmount: 500_000,
          companyId: companyAId,
        },
      });
      const row = await raw.contract.create({
        data: {
          contractNumber: 'CON-2026-0001',
          customerId: customerBId,
          unitId: unitBId,
          totalAmount: 500_000,
          companyId: companyBId,
        },
      });
      expect(row.contractNumber).toBe('CON-2026-0001');
      expect(row.companyId).toBe(companyBId);
    });

    it('duplicate contractNumber within the same company is rejected (P2002)', async () => {
      const raw = testApp.rawPrisma;
      await raw.contract.create({
        data: {
          contractNumber: 'CON-2026-0002',
          customerId: customerAId,
          unitId: unitAId,
          totalAmount: 500_000,
          companyId: companyAId,
        },
      });
      await expectP2002(() =>
        raw.contract.create({
          data: {
            contractNumber: 'CON-2026-0002',
            customerId: customerAId,
            unitId: unitAId,
            totalAmount: 500_000,
            companyId: companyAId,
          },
        }),
      );
    });

    it('multiple NULL contractNumbers are allowed within the same company', async () => {
      const raw = testApp.rawPrisma;
      await raw.contract.create({
        data: { customerId: customerAId, unitId: unitAId, totalAmount: 500_000, companyId: companyAId },
      });
      const row = await raw.contract.create({
        data: { customerId: customerAId, unitId: unitAId, totalAmount: 500_000, companyId: companyAId },
      });
      expect(row.contractNumber).toBeNull();
    });
  });

  // ── Broker.code ────────────────────────────────────────────────────────────

  describe('Broker.code — @@unique([companyId, code])', () => {
    afterEach(async () => {
      await testApp.rawPrisma.broker.deleteMany({
        where: { companyId: { in: [companyAId, companyBId] } },
      });
    });

    it('two companies can each hold a broker with the same code', async () => {
      const raw = testApp.rawPrisma;
      await raw.broker.create({
        data: { companyName: 'Broker Alpha', code: 'ALPHA', companyId: companyAId },
      });
      const row = await raw.broker.create({
        data: { companyName: 'Broker Alpha Too', code: 'ALPHA', companyId: companyBId },
      });
      expect(row.code).toBe('ALPHA');
      expect(row.companyId).toBe(companyBId);
    });

    it('duplicate broker code within the same company is rejected (P2002)', async () => {
      const raw = testApp.rawPrisma;
      await raw.broker.create({
        data: { companyName: 'Broker Beta', code: 'BETA', companyId: companyAId },
      });
      await expectP2002(() =>
        raw.broker.create({
          data: { companyName: 'Broker Beta 2', code: 'BETA', companyId: companyAId },
        }),
      );
    });
  });

  // ── Broker.taxId ───────────────────────────────────────────────────────────

  describe('Broker.taxId — @@unique([companyId, taxId])', () => {
    afterEach(async () => {
      await testApp.rawPrisma.broker.deleteMany({
        where: { companyId: { in: [companyAId, companyBId] } },
      });
    });

    it('two companies can each hold a broker with the same taxId', async () => {
      const raw = testApp.rawPrisma;
      await raw.broker.create({
        data: { companyName: 'Broker Gamma', code: 'GAMMA-A', taxId: 'TAX-001', companyId: companyAId },
      });
      const row = await raw.broker.create({
        data: { companyName: 'Broker Gamma Too', code: 'GAMMA-B', taxId: 'TAX-001', companyId: companyBId },
      });
      expect(row.taxId).toBe('TAX-001');
      expect(row.companyId).toBe(companyBId);
    });

    it('duplicate broker taxId within the same company is rejected (P2002)', async () => {
      const raw = testApp.rawPrisma;
      await raw.broker.create({
        data: { companyName: 'Broker Delta', code: 'DELTA-1', taxId: 'TAX-002', companyId: companyAId },
      });
      await expectP2002(() =>
        raw.broker.create({
          data: { companyName: 'Broker Delta 2', code: 'DELTA-2', taxId: 'TAX-002', companyId: companyAId },
        }),
      );
    });

    it('multiple NULL taxIds are allowed within the same company', async () => {
      const raw = testApp.rawPrisma;
      await raw.broker.create({
        data: { companyName: 'No Tax A', code: 'NOTAX-1', companyId: companyAId },
      });
      const row = await raw.broker.create({
        data: { companyName: 'No Tax B', code: 'NOTAX-2', companyId: companyAId },
      });
      expect(row.taxId).toBeNull();
    });
  });

  // ── Project.code (P-3) ─────────────────────────────────────────────────────

  describe('Project.code — @@unique([companyId, code])', () => {
    afterEach(async () => {
      await testApp.rawPrisma.project.updateMany({
        where: { id: { in: [projectAId, projectBId] } },
        data: { code: null },
      });
    });

    it('two companies can each hold a project with the same code', async () => {
      const raw = testApp.rawPrisma;
      await raw.project.update({ where: { id: projectAId }, data: { code: 'NORTH-TOWER' } });
      const row = await raw.project.update({ where: { id: projectBId }, data: { code: 'NORTH-TOWER' } });
      expect(row.code).toBe('NORTH-TOWER');
      expect(row.companyId).toBe(companyBId);
    });

    it('duplicate project code within the same company is rejected (P2002)', async () => {
      const raw = testApp.rawPrisma;
      await raw.project.update({ where: { id: projectAId }, data: { code: 'SOUTH-TOWER' } });
      const extra = await raw.project.create({
        data: {
          name: { ar: 'إضافي', en: 'Extra' },
          description: { ar: '', en: '' },
          city: 'Cairo',
          lat: 30.2,
          lng: 31.2,
          companyId: companyAId,
        },
      });
      try {
        await expectP2002(() =>
          raw.project.update({ where: { id: extra.id }, data: { code: 'SOUTH-TOWER' } }),
        );
      } finally {
        await raw.project.delete({ where: { id: extra.id } });
      }
    });
  });

  // ── Phase.code (P-3) ───────────────────────────────────────────────────────

  describe('Phase.code — @@unique([projectId, code])', () => {
    afterEach(async () => {
      await testApp.rawPrisma.phase.updateMany({
        where: { id: { in: [phaseAId, phaseBId] } },
        data: { code: null },
      });
    });

    it('phases in different projects can share the same code', async () => {
      const raw = testApp.rawPrisma;
      await raw.phase.update({ where: { id: phaseAId }, data: { code: 'PH-1' } });
      const row = await raw.phase.update({ where: { id: phaseBId }, data: { code: 'PH-1' } });
      expect(row.code).toBe('PH-1');
      expect(row.projectId).toBe(projectBId);
    });

    it('duplicate phase code within the same project is rejected (P2002)', async () => {
      const raw = testApp.rawPrisma;
      await raw.phase.update({ where: { id: phaseAId }, data: { code: 'PH-2' } });
      const extra = await raw.phase.create({
        data: { projectId: projectAId, name: { ar: 'إضافي', en: 'Extra' }, companyId: companyAId },
      });
      try {
        await expectP2002(() =>
          raw.phase.update({ where: { id: extra.id }, data: { code: 'PH-2' } }),
        );
      } finally {
        await raw.building.deleteMany({ where: { phaseId: extra.id } });
        await raw.phase.delete({ where: { id: extra.id } });
      }
    });
  });

  // ── Building.code ──────────────────────────────────────────────────────────

  describe('Building.code — @@unique([phaseId, code])', () => {
    it('buildings in different phases can share the same code', async () => {
      // beforeAll created code='TOWER-A' in phaseA and phaseB — both must exist.
      const raw = testApp.rawPrisma;
      const countA = await raw.building.count({ where: { phaseId: phaseAId, code: 'TOWER-A' } });
      const countB = await raw.building.count({ where: { phaseId: phaseBId, code: 'TOWER-A' } });
      expect(countA).toBe(1);
      expect(countB).toBe(1);
    });

    it('duplicate building code within the same phase is rejected (P2002)', async () => {
      await expectP2002(() =>
        testApp.rawPrisma.building.create({
          data: { phaseId: phaseAId, name: 'Nile Tower', code: 'TOWER-A', companyId: companyAId },
        }),
      );
    });

    it('multiple NULL building codes are allowed within the same phase', async () => {
      const raw = testApp.rawPrisma;
      await raw.building.create({
        data: { phaseId: phaseAId, name: 'No-code Building 1', companyId: companyAId },
      });
      const row = await raw.building.create({
        data: { phaseId: phaseAId, name: 'No-code Building 2', companyId: companyAId },
      });
      expect(row.code).toBeNull();
      await raw.building.deleteMany({ where: { phaseId: phaseAId, code: null } });
    });
  });
});
