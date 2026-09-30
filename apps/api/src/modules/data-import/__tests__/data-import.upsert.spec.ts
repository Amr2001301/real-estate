/**
 * applyPlan uses upsert, not create/update.
 *
 * UC-1: applyPlan calls project.upsert (not create or update) — confirms the
 *       mechanism is in place.
 *
 * UC-2: intra-request race window — applyPlan is called with a plan where
 *       op='create', but the row already exists in the DB (inserted between
 *       parseAndValidate and applyPlan within the SAME request). The upsert
 *       is self-correcting: it takes the update branch silently and returns
 *       success. The result still reports the plan forecast count (totalCreated=1).
 *
 *       This is the window DI-E2E-2 does NOT cover: DI-E2E-2 makes two separate
 *       HTTP requests, so parseAndValidate runs twice and re-discovers the row
 *       on the second call. UC-2 exercises the narrow window where parseAndValidate
 *       ran once, said 'create', and then the DB changed before applyPlan ran.
 */

import { DataImportService } from '../data-import.service';
import type { ImportPlan } from '../data-import.types';
import { PROJECTS_SHEET, PHASES_SHEET, BUILDINGS_SHEET, UNITS_SHEET, CUSTOMERS_SHEET, LEADS_SHEET } from '../../../common/utils/import-headers';

const COMPANY_ID = 'cccccccc-1111-0000-0000-000000000001';
const ACTOR_ID   = 'cccccccc-1111-0000-0000-000000000002';
const PROJECT_ID = 'dddddddd-1111-0000-0000-000000000001';

function makeEmptySheetPlan(sheetName: string) {
  return { sheetName, ops: [], errors: [], warnings: [], errorCount: 0 };
}

function buildPlanWithOneProjectCreate(): ImportPlan {
  return {
    companyId: COMPANY_ID,
    hasErrors: false,
    projects: {
      sheetName: PROJECTS_SHEET.name,
      ops: [
        {
          rowNumber: 2,
          op: 'create',
          code: 'RACE-PROJ',
          city: 'Cairo',
          nameAr: 'مشروع',
          nameEn: 'Project',
          descAr: null,
          descEn: null,
        },
      ],
      errors: [],
      warnings: [],
      errorCount: 0,
    },
    phases:    makeEmptySheetPlan(PHASES_SHEET.name),
    buildings: makeEmptySheetPlan(BUILDINGS_SHEET.name),
    units:     makeEmptySheetPlan(UNITS_SHEET.name),
    customers: makeEmptySheetPlan(CUSTOMERS_SHEET.name),
    leads:     makeEmptySheetPlan(LEADS_SHEET.name),
    crossTenantPhoneConflicts: 0,
    unresolvedLeadSalesReps: 0,
  };
}

interface MockPrisma {
  auditLog: { create: jest.Mock };
  $transaction: jest.Mock;
  _txCalls: Array<Record<string, Record<string, jest.Mock>>>;
}

function buildImportPrisma(upsertReturnId: string): MockPrisma {
  const txCalls: Array<Record<string, Record<string, jest.Mock>>> = [];
  return {
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    _txCalls: txCalls,
    $transaction: jest.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        project:  { upsert:  jest.fn().mockResolvedValue({ id: upsertReturnId }) },
        phase:    { upsert:  jest.fn().mockResolvedValue({ id: 'p-id' }) },
        building: { upsert:  jest.fn().mockResolvedValue({ id: 'b-id' }) },
        unit:     { upsert:  jest.fn().mockResolvedValue({ id: 'u-id' }) },
        // Customers and leads sheets are empty in the test plan; the transactions
        // will iterate zero ops and never call these, but they must exist to avoid
        // runtime undefined-access if applyPlan ever reads the delegate.
        user: { create: jest.fn().mockResolvedValue({ id: 'usr-id' }), update: jest.fn().mockResolvedValue({}) },
        lead: { create: jest.fn().mockResolvedValue({ id: 'lead-id' }), update: jest.fn().mockResolvedValue({}) },
      };
      txCalls.push(tx);
      return fn(tx);
    }),
  };
}

// ── UC-1: upsert is called, not create/update ─────────────────────────────────

describe('DataImportService — applyPlan uses upsert', () => {
  it('UC-1: calls project.upsert with the natural-key where clause', async () => {
    const prisma = buildImportPrisma(PROJECT_ID);
    const service = new DataImportService(prisma as never);
    const plan = buildPlanWithOneProjectCreate();

    await service.applyPlan(plan, ACTOR_ID);

    // $transaction was called (once per sheet)
    expect(prisma.$transaction).toHaveBeenCalled();

    // The first transaction (Projects) called tx.project.upsert with the natural key
    const projectTx = prisma._txCalls[0]!;
    const projectDelegate = projectTx['project']!;
    expect(projectDelegate['upsert']).toHaveBeenCalledTimes(1);
    expect(projectDelegate['upsert']).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId_code: { companyId: COMPANY_ID, code: 'RACE-PROJ' } },
      }),
    );

    // No bare create or update on the tx.project object (only upsert is defined)
    expect(projectDelegate['create']).toBeUndefined();
    expect(projectDelegate['update']).toBeUndefined();
  });
});

// ── UC-2: intra-request race window ───────────────────────────────────────────
//
// applyPlan is given a plan that says op='create', but the row was inserted
// between parseAndValidate and applyPlan within the same request.

describe('DataImportService — intra-request race window (applyPlan with stale create plan)', () => {
  it('UC-2: applyPlan with op=create succeeds when the row already exists in the DB (upsert takes update branch)', async () => {
    // The upsert mock returns an existing row id — simulating that the DB already
    // had the row and the upsert resolved via the update branch silently.
    const EXISTING_ROW_ID = 'eeeeeeee-0000-0000-0000-000000000001';
    const prisma = buildImportPrisma(EXISTING_ROW_ID);
    const service = new DataImportService(prisma as never);
    const plan = buildPlanWithOneProjectCreate();

    // Must not throw
    const result = await service.applyPlan(plan, ACTOR_ID);

    // Counts reflect the plan forecast (create=1) even though the DB upserted an existing row
    expect(result.projects.created).toBe(1);
    expect(result.projects.updated).toBe(0);
    expect(result.totalCreated).toBe(1);

    // Audit log written
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
  });
});
