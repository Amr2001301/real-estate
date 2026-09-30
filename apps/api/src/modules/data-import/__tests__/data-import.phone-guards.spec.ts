/**
 * Phone-guard proof tests.
 *
 * PG-1: Silent-merge guard — E.164 stored phone
 *   Seed: a CLIENT user stored with phone "+201062800394" (E.164, as written by the
 *   auth service).  Import: Customers sheet with cell "1062800394" (10-digit, repairable
 *   to "01062800394").  The repaired phone matches the stored user once the E.164 map
 *   fix is applied.  Assert: blocking row error, no op queued for that row.
 *
 * PG-2: Cross-tenant detection — E.164 stored phone
 *   Same stored phone "+201062800394" but belonging to a DIFFERENT company.
 *   Assert: blocking row error, crossTenantPhoneConflicts=1.
 *
 * PG-3: Normal path — auth-created user (E.164) matches on update
 *   Stored "+201062800394" (same company, role CLIENT), import cell "01062800394"
 *   (already canonical — repaired=false).  Assert: op='unchanged' (or 'update'
 *   if fullName differs), no error.
 */

import { Workbook, ValueType } from 'exceljs';
import { UserRole } from '@prisma/client';
import { DataImportService } from '../data-import.service';
import { CUSTOMERS_SHEET, PROJECTS_SHEET } from '../../../common/utils/import-headers';

// ── Fixture ───────────────────────────────────────────────────────────────────

const COMPANY_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const COMPANY_B = 'bbbbbbbb-0000-0000-0000-000000000002';

const AUTH_USER_E164 = {
  id: 'user-0000-0000-0000-000000000001',
  phone: '+201062800394',          // E.164 — written by auth service
  fullName: 'Ahmed Ali',
  email: 'ahmed@example.com',
  locale: 'ar' as const,
  role: UserRole.CLIENT,
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

/** Build a Workbook with a Customers sheet containing one row. */
async function buildCustomersXlsx(phoneCell: string): Promise<Buffer> {
  const wb = new Workbook();

  // Minimal Projects sheet (required by parseAndValidate to not error on missing sheet)
  const pws = wb.addWorksheet(PROJECTS_SHEET.name);
  pws.addRow([PROJECTS_SHEET.fields.code, PROJECTS_SHEET.fields.nameAr, PROJECTS_SHEET.fields.nameEn, PROJECTS_SHEET.fields.city, PROJECTS_SHEET.fields.status]);

  // Customers sheet
  const cws = wb.addWorksheet(CUSTOMERS_SHEET.name);
  cws.addRow([CUSTOMERS_SHEET.fields.fullName, CUSTOMERS_SHEET.fields.phone]);
  cws.addRow(['Ahmed Ali', phoneCell]);

  return Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer);
}

type GlobalHit = { id: string; phone: string | null; role: UserRole; companyId: string | null };

/** Build a mock Prisma that returns the given users per findMany call. */
function buildMockPrisma(clientUsers: typeof AUTH_USER_E164[], globalHits: GlobalHit[]) {
  const empty = jest.fn().mockResolvedValue([]);
  return {
    project:     { findMany: empty },
    phase:       { findMany: empty },
    building:    { findMany: empty },
    unit:        { findMany: empty },
    contract:    { findMany: empty },
    reservation: { findMany: empty },
    user:        {
      findMany: jest.fn()
        // First call: dbClients (company CLIENTs, role=CLIENT)
        .mockResolvedValueOnce(clientUsers)
        // Second call: globalPhoneHits (all companies, expanded phone set)
        .mockResolvedValueOnce(globalHits)
        // Third call: dbSalesUsers (ADMIN/SALES/SALES_MANAGER for sales-rep map)
        .mockResolvedValueOnce([]),
    },
    lead:        { findMany: empty },
    leadSource:  { findMany: empty },
  };
}

// ── PG-1: silent-merge guard fires for E.164-stored phone ─────────────────────

describe('DataImportService — PG-1: silent-merge guard (E.164 stored phone)', () => {
  it('repaired cell "1062800394" → normalised "01062800394" matches E.164 "+201062800394" user → blocking error, no op queued', async () => {
    // The stored user is in the SAME company — this triggers the repair-escalation guard.
    const clientInA = { ...AUTH_USER_E164, companyId: COMPANY_A };
    const globalHit = { id: clientInA.id, phone: clientInA.phone, role: UserRole.CLIENT, companyId: COMPANY_A };

    const prisma = buildMockPrisma([clientInA], [globalHit]);
    const service = new DataImportService(prisma as never);

    const buf = await buildCustomersXlsx('1062800394'); // 10-digit, repairable
    const plan = await service.parseAndValidate(buf, COMPANY_A);

    // The row must be rejected (repair escalation)
    expect(plan.customers.errorCount).toBeGreaterThan(0);
    const err = plan.customers.errors[0]!;
    expect(err.message).toMatch(/normalised/i);
    expect(err.message).toContain('01062800394');

    // No op was queued for this row
    expect(plan.customers.ops).toHaveLength(0);

    // hasErrors flag reflects the row rejection
    expect(plan.hasErrors).toBe(true);
  });
});

// ── PG-2: cross-tenant detection — E.164 stored phone ─────────────────────────

describe('DataImportService — PG-2: cross-tenant detection (E.164 stored phone)', () => {
  it('phone "+201062800394" belonging to Company B is blocking for Company A import, crossTenantPhoneConflicts=1', async () => {
    // The E.164 user belongs to Company B — cross-tenant collision for Company A.
    const clientInB = { ...AUTH_USER_E164, companyId: COMPANY_B };
    const globalHit = { id: clientInB.id, phone: clientInB.phone, role: UserRole.CLIENT, companyId: COMPANY_B };

    // dbClients for Company A returns nothing (no existing CLIENT with that phone in A)
    const prisma = buildMockPrisma([], [globalHit]);
    const service = new DataImportService(prisma as never);

    // Import canonical form — no repair needed
    const buf = await buildCustomersXlsx('01062800394');
    const plan = await service.parseAndValidate(buf, COMPANY_A);

    expect(plan.crossTenantPhoneConflicts).toBe(1);
    expect(plan.customers.errorCount).toBeGreaterThan(0);
    expect(plan.customers.errors[0]!.message).toMatch(/another company/i);
    expect(plan.customers.ops).toHaveLength(0);
  });
});

// ── PG-3: update path — auth-created user with E.164 phone is found ──────────

describe('DataImportService — PG-3: update path (E.164 stored, canonical import cell)', () => {
  it('existing CLIENT "+201062800394" (same company) + canonical cell "01062800394" → op update or unchanged, no error', async () => {
    const clientInA = { ...AUTH_USER_E164, companyId: COMPANY_A };
    const globalHit = { id: clientInA.id, phone: clientInA.phone, role: UserRole.CLIENT, companyId: COMPANY_A };

    const prisma = buildMockPrisma([clientInA], [globalHit]);
    const service = new DataImportService(prisma as never);

    // Canonical cell — repaired=false — repair escalation guard does NOT fire
    const buf = await buildCustomersXlsx('01062800394');
    const plan = await service.parseAndValidate(buf, COMPANY_A);

    expect(plan.customers.errorCount).toBe(0);
    expect(plan.customers.ops).toHaveLength(1);
    // fullName is the same in both file and DB → unchanged
    expect(plan.customers.ops[0]!.op).toBe('unchanged');
    expect(plan.customers.ops[0]!.id).toBe(AUTH_USER_E164.id);
  });
});
