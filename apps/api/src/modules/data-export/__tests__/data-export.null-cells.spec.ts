/**
 * Null-cell uniformity — Fix 1 regression guard.
 *
 * Every cell in every data row must be written to the XLSX file even when its
 * value is null. "Written" means the cell exists in the serialized sheet and has
 * a numFmt attribute — the import parser relies on a stable column layout and
 * must never encounter a missing cell where a value *could* exist.
 *
 * This spec generates one data row per sheet where every optional field is null,
 * then reloads the buffer and verifies that row 2 has cells at all column
 * positions 1..headerCount.
 */

import { Workbook } from 'exceljs';
import { DataExportService } from '../data-export.service';

// ── Shared stubs ──────────────────────────────────────────────────────────────

const name = { ar: 'اختبار', en: 'Test' };
const now  = new Date('2026-01-01T00:00:00Z');
const proj = { code: null, name };
const phase = { code: null, name, project: proj };
const building = { code: null, name: 'B', phase };
const unit  = { code: 'U-001', building };
const customer = { phone: null, fullName: 'عميل' };

// ── Mock builder ──────────────────────────────────────────────────────────────

function buildMock() {
  const none = jest.fn().mockResolvedValue([]);
  return {
    company: {
      findUnique: jest.fn().mockResolvedValue({ name: 'Test Co', displayName: null }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ fullName: 'Test Admin' }),
      findMany: jest.fn().mockResolvedValue([
        { fullName: 'عميل واحد', phone: null, email: null, locale: 'ar', createdAt: now },
      ]),
    },
    project: { findMany: jest.fn().mockResolvedValue([
      { code: null, name, description: name, city: 'القاهرة', status: 'DRAFT', createdAt: now },
    ]) },
    phase: { findMany: jest.fn().mockResolvedValue([
      { code: null, name, order: 1, createdAt: now, project: proj },
    ]) },
    building: { findMany: jest.fn().mockResolvedValue([
      { code: null, name: 'A', totalFloors: 5, order: 1, createdAt: now, phase },
    ]) },
    unit: { findMany: jest.fn().mockResolvedValue([
      {
        code: 'U-001', type: 'APARTMENT', floor: 1,
        area: 80, bedrooms: 2, bathrooms: 1,
        price: { toString: () => '500000' },
        status: 'AVAILABLE', createdAt: now,
        building,
      },
    ]) },
    lead: { findMany: jest.fn().mockResolvedValue([
      {
        id: 'aaaabbbb-0000-4000-8000-000000000001',
        fullName: 'فرصة بدون تفاصيل',
        phone: '01099999999',
        email: null,           // optional — null
        stage: 'NEW',
        createdAt: now,
        updatedAt: now,
        source: null,          // optional — null
        assignedSales: null,   // optional — null
        projectInterest: null, // optional — null
        unitInterest: null,    // optional — null
      },
    ]) },
    contract: { findMany: jest.fn().mockResolvedValue([
      {
        contractNumber: 'C-0001',
        totalAmount: { toString: () => '1000000' },
        downPayment: { toString: () => '100000' },
        status: 'ACTIVE',
        signedAt: null,      // optional — null
        createdAt: now,
        customer,
        unit: { code: 'U-001', building },
        cancellation: null,  // optional — null
      },
    ]) },
    installmentPlan: { findMany: jest.fn().mockResolvedValue([
      {
        totalMonths: 12,
        monthlyAmount: { toString: () => '10000' },
        startsAt: now,
        frequency: 'MONTHLY',
        createdAt: now,
        contract: { contractNumber: 'C-0001' },
      },
    ]) },
    installment: { findMany: jest.fn().mockResolvedValue([
      {
        dueDate: now,
        amount: { toString: () => '10000' },
        status: 'PENDING',
        paidAt: null,  // optional — null
        type: 'INSTALLMENT',
        plan: { contract: { contractNumber: 'C-0001', customer: { phone: null }, unit: { code: 'U-001' } } },
      },
    ]) },
    deposit: { findMany: jest.fn().mockResolvedValue([
      {
        id: 'dddd0000-0000-4000-8000-000000000001',
        type: 'DOWN_PAYMENT',
        amount: { toString: () => '100000' },
        paidAt: now,
        reviewStatus: 'PENDING_REVIEW',
        paymentMethod: null,        // optional — null
        contract: null,             // optional — null (deposit via installment path)
        installment: null,          // optional — null (both null → empty customer/contract cells)
        paymentInstrument: null,    // optional — null
        recordedBy: { fullName: 'مدير' },
      },
    ]) },
    paymentInstrument: { findMany: jest.fn().mockResolvedValue([
      {
        id: 'eeee0000-0000-4000-8000-000000000001',
        type: 'CHEQUE',
        status: 'PENDING',
        chequeNumber: null,     // optional — null
        drawerBankName: null,   // optional — null
        bankName: null,         // optional — null
        referenceNumber: null,  // optional — null
        chequeDueDate: null,    // optional — null
        clearingDate: null,     // optional — null
        bounceReason: null,     // optional — null
        bounceDate: null,       // optional — null
        createdAt: now,
        replacedById: null,     // optional — null
        deposits: [],
        recordedBy: { fullName: 'مدير' },
      },
    ]) },
    refund: { findMany: jest.fn().mockResolvedValue([
      {
        id: 'ffff0000-0000-4000-8000-000000000001',
        amount: { toString: () => '50000' },
        paymentMethod: 'BANK_TRANSFER',
        referenceNumber: null,  // optional — null
        bankName: null,         // optional — null
        paidAt: now,
        cancellation: {
          cancellationDate: now,
          contract: { contractNumber: 'C-0001', customer },
        },
        recordedBy: { fullName: 'مدير' },
      },
    ]) },
    broker: { findMany: jest.fn().mockResolvedValue([
      {
        code: 'BRK-001',
        companyName: 'شركة الوساطة',
        taxId: null,    // optional — null
        phone: null,    // optional — null
        email: null,    // optional — null
        city: null,     // optional — null
        defaultCommissionPct: { toString: () => '2.5' },
        status: 'ACTIVE',
        createdAt: now,
      },
    ]) },
    brokerCommission: { findMany: jest.fn().mockResolvedValue([
      {
        commissionNumber: 'COM-0001',
        basisAmount: { toString: () => '1000000' },
        commissionPct: null,                // optional — null
        grossAmount: { toString: () => '25000' },
        netAmount: { toString: () => '25000' },
        status: 'EARNED',
        earnedAt: now,
        clawbackStatus: null,              // optional — null
        clawbackAt: null,                  // optional — null
        clawbackCollectedAmount: null,     // optional — null
        contract: { contractNumber: 'C-0001', customer: { phone: null } },
        unit: { code: 'U-001' },
        project: proj,
        broker: { code: 'BRK-001', companyName: 'شركة الوساطة' },
      },
    ]) },
    maintenanceRequest: { findMany: jest.fn().mockResolvedValue([
      {
        id: 'mmmm0000-0000-4000-8000-000000000001',
        description: 'وصف الطلب',
        status: 'OPEN',
        priority: null,      // optional — null
        resolvedAt: null,    // optional — null
        createdAt: now,
        customer: { fullName: 'عميل', phone: null },
        unit: { code: 'U-001', building },
        category: { name },
        assignedAdmin: null, // optional — null
      },
    ]) },
  };
}

// ── Expected sheet layout (must stay in sync with data-export.service.ts) ────

const DATA_SHEETS: Array<{ name: string; headerCount: number }> = [
  { name: 'Projects',           headerCount:  8 },
  { name: 'Phases',             headerCount:  8 },
  { name: 'Buildings',          headerCount: 11 },
  { name: 'Units',              headerCount: 17 },
  { name: 'Customers',          headerCount:  5 },
  { name: 'Leads',              headerCount: 13 },
  { name: 'Contracts',          headerCount: 19 },
  { name: 'InstallmentPlans',   headerCount:  7 },
  { name: 'Installments',       headerCount:  9 },
  { name: 'Deposits',           headerCount: 11 },
  { name: 'PaymentInstruments', headerCount: 14 },
  { name: 'Refunds',            headerCount: 11 },
  { name: 'Brokers',            headerCount:  9 },
  { name: 'Commissions',        headerCount: 17 },
  { name: 'Maintenance',        headerCount: 17 },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DataExportService — null-cell uniformity', () => {
  let wb: Workbook;

  beforeAll(async () => {
    const mock    = buildMock();
    const service = new DataExportService(mock as never);
    const result  = await service.generate('test-company-id', 'test-actor-id');

    wb = new Workbook();
    await wb.xlsx.load(result.buffer as unknown as ArrayBuffer);
  });

  it.each(DATA_SHEETS)(
    '$name: data row has cells at all $headerCount column positions (no missing cells)',
    ({ name, headerCount }) => {
      const ws = wb.getWorksheet(name);
      expect(ws).toBeDefined();

      // Row 1 = header, row 2 = first (and only) data row
      expect(ws!.rowCount).toBe(2);

      for (let col = 1; col <= headerCount; col++) {
        const cell = ws!.getRow(2).getCell(col);
        // The cell must have been explicitly styled — numFmt is always set
        // by writeTextCell/writeDateCell/writeDateTimeCell/writeAmountCell/
        // writeIntCell/writeDecimalCell even when value is null.
        expect(cell.numFmt).toBeTruthy();
      }
    },
  );
});
