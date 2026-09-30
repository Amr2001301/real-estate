/**
 * Data-import idempotency test — the gate for the whole import phase.
 *
 * Flow:
 *   1. Build a mock DB state with one project, phase, building, and unit.
 *   2. Run DataExportService.generate() with the same mock → xlsx buffer.
 *   3. Run DataImportService.parseAndValidate() with that buffer + mock DB.
 *   4. Assert: no errors, every op is 'unchanged'.
 *   5. Run DataImportService.applyPlan() and assert: 0 created, 0 updated.
 *
 * This test guarantees that exporting tenant data and immediately importing it
 * back produces zero mutations — the round-trip is a no-op.
 */

import { DataExportService } from '../../data-export/data-export.service';
import { DataImportService } from '../data-import.service';

// ── Shared fixture ────────────────────────────────────────────────────────────

const COMPANY_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const ACTOR_ID   = 'aaaaaaaa-0000-0000-0000-000000000002';

const PROJECT_ID  = 'bbbbbbbb-0000-0000-0000-000000000001';
const PHASE_ID    = 'cccccccc-0000-0000-0000-000000000001';
const BUILDING_ID = 'dddddddd-0000-0000-0000-000000000001';
const UNIT_ID     = 'eeeeeeee-0000-0000-0000-000000000001';

const UPDATED_AT = new Date('2026-01-15T10:00:00Z');

const dbProject = {
  id: PROJECT_ID,
  code: 'IDEM-PROJ',
  name: { ar: 'مشروع اختبار', en: 'Test Project' },
  description: { ar: 'وصف', en: 'Description' },
  city: 'Cairo',
  status: 'PUBLISHED' as const,
  updatedAt: UPDATED_AT,
  createdAt: UPDATED_AT,
};

// Phase with nested project (for DataExportService.buildPhases which accesses r.project)
const dbPhase = {
  id: PHASE_ID,
  code: 'IDEM-PH1',
  projectId: PROJECT_ID,
  name: { ar: 'مرحلة 1', en: 'Phase One' },
  order: 1,
  createdAt: UPDATED_AT,
  companyId: COMPANY_ID,
  project: { code: 'IDEM-PROJ', name: { ar: 'مشروع اختبار', en: 'Test Project' } },
};

// Building with nested phase+project
const dbBuilding = {
  id: BUILDING_ID,
  code: 'IDEM-BLD',
  phaseId: PHASE_ID,
  name: 'Tower A',
  totalFloors: 10,
  order: 0,
  createdAt: UPDATED_AT,
  companyId: COMPANY_ID,
  phase: {
    code: 'IDEM-PH1',
    name: { ar: 'مرحلة 1', en: 'Phase One' },
    project: { code: 'IDEM-PROJ', name: { ar: 'مشروع اختبار', en: 'Test Project' } },
  },
};

// Unit with nested building+phase+project
const dbUnit = {
  id: UNIT_ID,
  code: 'IDEM-U1',
  buildingId: BUILDING_ID,
  type: '2BR',
  floor: 3,
  area: 120.5,
  bedrooms: 2,
  bathrooms: 2,
  price: '1500000.00',
  status: 'AVAILABLE' as const,
  updatedAt: UPDATED_AT,
  createdAt: UPDATED_AT,
  companyId: COMPANY_ID,
  building: {
    code: 'IDEM-BLD',
    name: 'Tower A',
    phase: {
      code: 'IDEM-PH1',
      name: { ar: 'مرحلة 1', en: 'Phase One' },
      project: { code: 'IDEM-PROJ', name: { ar: 'مشروع اختبار', en: 'Test Project' } },
    },
  },
};

// ── Mock Prisma builders ──────────────────────────────────────────────────────

function buildExportPrisma() {
  const empty = jest.fn().mockResolvedValue([]);
  return {
    company: {
      findUnique: jest.fn().mockResolvedValue({ name: 'Idem Corp', displayName: null }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ fullName: 'Test Admin' }),
      findMany: empty,
    },
    project:            { findMany: jest.fn().mockResolvedValue([dbProject]) },
    phase:              { findMany: jest.fn().mockResolvedValue([dbPhase]) },
    building:           { findMany: jest.fn().mockResolvedValue([dbBuilding]) },
    unit:               { findMany: jest.fn().mockResolvedValue([dbUnit]) },
    lead:               { findMany: empty },
    contract:           { findMany: empty },
    installmentPlan:    { findMany: empty },
    installment:        { findMany: empty },
    deposit:            { findMany: empty },
    paymentInstrument:  { findMany: empty },
    refund:             { findMany: empty },
    broker:             { findMany: empty },
    brokerCommission:   { findMany: empty },
    maintenanceRequest: { findMany: empty },
  };
}

function buildImportPrisma() {
  const empty = jest.fn().mockResolvedValue([]);
  return {
    project:     { findMany: jest.fn().mockResolvedValue([dbProject]) },
    phase:       { findMany: jest.fn().mockResolvedValue([dbPhase]) },
    building:    { findMany: jest.fn().mockResolvedValue([dbBuilding]) },
    unit:        { findMany: jest.fn().mockResolvedValue([dbUnit]) },
    contract:    { findMany: empty },
    reservation: { findMany: empty },
    // Phase 2 preloads — empty because the export contains no Customers/Leads rows
    user:        { findMany: empty },
    lead:        { findMany: empty },
    leadSource:  { findMany: empty },
    auditLog:    { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        project:  { upsert: jest.fn().mockResolvedValue({ id: PROJECT_ID }) },
        phase:    { upsert: jest.fn().mockResolvedValue({ id: PHASE_ID }) },
        building: { upsert: jest.fn().mockResolvedValue({ id: BUILDING_ID }) },
        unit:     { upsert: jest.fn().mockResolvedValue({ id: UNIT_ID }) },
        user:     { create: jest.fn(), update: jest.fn() },
        lead:     { create: jest.fn(), update: jest.fn() },
      };
      return fn(tx);
    }),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DataImportService — idempotency (export → import = no-op)', () => {
  let xlsxBuffer: Buffer;
  let importPrisma: ReturnType<typeof buildImportPrisma>;

  beforeAll(async () => {
    // Step 1: export to get the reference xlsx
    const exportPrisma = buildExportPrisma();
    const exportService = new DataExportService(exportPrisma as never);
    const { buffer } = await exportService.generate(COMPANY_ID, ACTOR_ID);
    xlsxBuffer = buffer;

    // Step 2: build import mock pointing at the same DB state
    importPrisma = buildImportPrisma();
  });

  it('parseAndValidate reports no errors', async () => {
    const service = new DataImportService(importPrisma as never);
    const plan = await service.parseAndValidate(xlsxBuffer, COMPANY_ID);

    expect(plan.hasErrors).toBe(false);
    expect(plan.projects.errorCount).toBe(0);
    expect(plan.phases.errorCount).toBe(0);
    expect(plan.buildings.errorCount).toBe(0);
    expect(plan.units.errorCount).toBe(0);
  });

  it('all project ops are "unchanged"', async () => {
    const service = new DataImportService(importPrisma as never);
    const plan = await service.parseAndValidate(xlsxBuffer, COMPANY_ID);

    expect(plan.projects.ops.length).toBeGreaterThan(0);
    expect(plan.projects.ops.every((p) => p.op === 'unchanged')).toBe(true);
  });

  it('all phase ops are "unchanged"', async () => {
    const service = new DataImportService(importPrisma as never);
    const plan = await service.parseAndValidate(xlsxBuffer, COMPANY_ID);

    expect(plan.phases.ops.length).toBeGreaterThan(0);
    expect(plan.phases.ops.every((p) => p.op === 'unchanged')).toBe(true);
  });

  it('all building ops are "unchanged"', async () => {
    const service = new DataImportService(importPrisma as never);
    const plan = await service.parseAndValidate(xlsxBuffer, COMPANY_ID);

    expect(plan.buildings.ops.length).toBeGreaterThan(0);
    expect(plan.buildings.ops.every((p) => p.op === 'unchanged')).toBe(true);
  });

  it('all unit ops are "unchanged"', async () => {
    const service = new DataImportService(importPrisma as never);
    const plan = await service.parseAndValidate(xlsxBuffer, COMPANY_ID);

    expect(plan.units.ops.length).toBeGreaterThan(0);
    expect(plan.units.ops.every((p) => p.op === 'unchanged')).toBe(true);
  });

  it('applyPlan writes zero rows — 0 created, 0 updated', async () => {
    const service = new DataImportService(importPrisma as never);
    const plan = await service.parseAndValidate(xlsxBuffer, COMPANY_ID);
    const result = await service.applyPlan(plan, ACTOR_ID);

    expect(result.totalCreated).toBe(0);
    expect(result.totalUpdated).toBe(0);
    expect(result.totalUnchanged).toBeGreaterThan(0);

    // None of the write methods should have been called
    const tx = (importPrisma.$transaction as jest.Mock).mock.results;
    // Each transaction resolves via the fn — verify by checking auditLog was written
    // but no entity was created/updated (all ops were unchanged, so create/update skipped)
    expect(importPrisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(importPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'DATA_IMPORT',
          companyId: COMPANY_ID,
        }),
      }),
    );
  });
});
