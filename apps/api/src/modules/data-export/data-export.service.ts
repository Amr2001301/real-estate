import { Injectable } from '@nestjs/common';
import { UserRole, type Prisma } from '@prisma/client';
import { type Cell, type Workbook, type Worksheet } from 'exceljs';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  PROJECTS_SHEET,
  PHASES_SHEET,
  BUILDINGS_SHEET,
  UNITS_SHEET,
} from '../../common/utils/import-headers';
import {
  applySheetChrome,
  createReportWorkbook,
  currencyNote,
  HAIRLINE_BORDER,
  styleHeaderCell,
  workbookToBuffer,
  writeAmountCell,
  writeDateCell,
  writeDateTimeCell,
  writeDecimalCell,
  writeIntCell,
  writeTextCell,
  XLSX_GOLD_COVER,
  XLSX_META_FILL,
  XLSX_MUTED,
  XLSX_NAVY,
  XLSX_TAB_BROKERS,
  XLSX_TAB_CATALOG,
  XLSX_TAB_FINANCIAL,
  XLSX_TAB_OPS,
  XLSX_TAB_PAYMENTS,
  XLSX_TAB_PEOPLE,
  XLSX_TAB_README,
  XLSX_ZEBRA,
} from '../../common/utils/xlsx';
import { DEFAULT_CURRENCY } from '../../common/currency/currency';
import { storedToImportPhone } from '../../common/utils/phone-normaliser';

// ── Local helpers ─────────────────────────────────────────────────────────────

function tr(value: Prisma.JsonValue | null | undefined): { ar: string; en: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ar: '', en: '' };
  const obj = value as Record<string, unknown>;
  return { ar: String(obj.ar ?? ''), en: String(obj.en ?? '') };
}

function shortRef(id: string): string {
  return id.slice(0, 8);
}

type ExportCell =
  | { t: 'text';     v: string | number | null | undefined }
  | { t: 'date';     v: Date | string | null | undefined }
  | { t: 'datetime'; v: Date | string | null | undefined }
  | { t: 'amount';   v: number | { toString(): string } | null | undefined }
  | { t: 'int';      v: number | null | undefined }
  | { t: 'decimal';  v: number | null | undefined };

// ── Service ───────────────────────────────────────────────────────────────────

export type ExportResult = {
  buffer: Buffer;
  sheetCounts: Record<string, number>;
  totalRows: number;
  companyName: string;
};

@Injectable()
export class DataExportService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(companyId: string, actorId: string): Promise<ExportResult> {
    const [
      company,
      actor,
      projects,
      phases,
      buildings,
      units,
      customers,
      leads,
      contracts,
      installmentPlans,
      installments,
      deposits,
      instruments,
      refunds,
      brokers,
      commissions,
      maintenance,
    ] = await Promise.all([
      this.prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true, displayName: true, currency: true },
      }),
      this.prisma.user.findUnique({
        where: { id: actorId },
        select: { fullName: true },
      }),
      this.prisma.project.findMany({
        where: { companyId },
        select: { code: true, name: true, description: true, city: true, status: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.phase.findMany({
        where: { companyId },
        select: {
          code: true, name: true, order: true, createdAt: true,
          project: { select: { code: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.building.findMany({
        where: { companyId },
        select: {
          code: true, name: true, totalFloors: true, order: true, createdAt: true,
          phase: { select: { code: true, name: true, project: { select: { code: true, name: true } } } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.unit.findMany({
        where: { companyId },
        select: {
          code: true, type: true, floor: true, area: true,
          bedrooms: true, bathrooms: true, price: true, status: true, createdAt: true,
          building: {
            select: {
              code: true,
              name: true,
              phase: { select: { code: true, name: true, project: { select: { code: true, name: true } } } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.user.findMany({
        where: { companyId, role: UserRole.CLIENT, phone: { not: null } },
        select: { fullName: true, phone: true, email: true, locale: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.lead.findMany({
        where: { companyId },
        select: {
          id: true, fullName: true, phone: true, email: true,
          stage: true, createdAt: true, updatedAt: true,
          source: { select: { name: true } },
          assignedSales: { select: { fullName: true } },
          projectInterest: { select: { name: true } },
          unitInterest: { select: { code: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.contract.findMany({
        where: { companyId, deletedAt: null },
        select: {
          contractNumber: true, totalAmount: true, downPayment: true,
          status: true, signedAt: true, createdAt: true,
          customer: { select: { phone: true, fullName: true } },
          unit: {
            select: {
              code: true,
              building: {
                select: {
                  name: true,
                  phase: { select: { name: true, project: { select: { name: true } } } },
                },
              },
            },
          },
          cancellation: {
            select: {
              cancellationDate: true, reason: true,
              retainedAmount: true, refundAmount: true,
              cancelledBy: { select: { fullName: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.installmentPlan.findMany({
        where: { companyId },
        select: {
          totalMonths: true, monthlyAmount: true, startsAt: true, frequency: true,
          createdAt: true,
          contract: { select: { contractNumber: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.installment.findMany({
        where: { companyId },
        select: {
          dueDate: true, amount: true, status: true, paidAt: true, type: true,
          plan: {
            select: {
              contract: {
                select: {
                  contractNumber: true,
                  customer: { select: { phone: true } },
                  unit: { select: { code: true } },
                },
              },
            },
          },
        },
        orderBy: [
          { plan: { contract: { contractNumber: 'asc' } } },
          { dueDate: 'asc' },
        ],
      }),
      this.prisma.deposit.findMany({
        where: { companyId, deletedAt: null },
        select: {
          id: true, type: true, amount: true, paidAt: true,
          reviewStatus: true, paymentMethod: true,
          contract: {
            select: {
              contractNumber: true,
              customer: { select: { phone: true, fullName: true } },
            },
          },
          installment: {
            select: {
              plan: {
                select: {
                  contract: {
                    select: {
                      contractNumber: true,
                      customer: { select: { phone: true, fullName: true } },
                    },
                  },
                },
              },
            },
          },
          paymentInstrument: { select: { id: true } },
          recordedBy: { select: { fullName: true } },
        },
        orderBy: { paidAt: 'asc' },
      }),
      this.prisma.paymentInstrument.findMany({
        where: { companyId },
        select: {
          id: true, type: true, status: true,
          chequeNumber: true, drawerBankName: true, bankName: true,
          referenceNumber: true, chequeDueDate: true, clearingDate: true,
          bounceReason: true, bounceDate: true, createdAt: true,
          replacedById: true,
          deposits: {
            select: {
              contract: { select: { contractNumber: true } },
              installment: {
                select: {
                  plan: { select: { contract: { select: { contractNumber: true } } } },
                },
              },
            },
          },
          recordedBy: { select: { fullName: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.refund.findMany({
        where: { companyId },
        select: {
          id: true, amount: true, paymentMethod: true,
          referenceNumber: true, bankName: true, paidAt: true,
          cancellation: {
            select: {
              cancellationDate: true,
              contract: {
                select: {
                  contractNumber: true,
                  customer: { select: { phone: true, fullName: true } },
                },
              },
            },
          },
          recordedBy: { select: { fullName: true } },
        },
        orderBy: { paidAt: 'asc' },
      }),
      this.prisma.broker.findMany({
        where: { companyId },
        select: {
          code: true, companyName: true, taxId: true,
          phone: true, email: true, city: true,
          defaultCommissionPct: true, status: true, createdAt: true,
        },
        orderBy: { code: 'asc' },
      }),
      this.prisma.brokerCommission.findMany({
        where: { companyId },
        select: {
          commissionNumber: true, basisAmount: true, commissionPct: true,
          grossAmount: true, netAmount: true, status: true, earnedAt: true,
          clawbackStatus: true, clawbackAt: true, clawbackCollectedAmount: true,
          contract: {
            select: {
              contractNumber: true,
              customer: { select: { phone: true } },
            },
          },
          unit: { select: { code: true } },
          project: { select: { name: true } },
          broker: { select: { code: true, companyName: true } },
        },
        orderBy: { earnedAt: 'asc' },
      }),
      this.prisma.maintenanceRequest.findMany({
        where: { companyId },
        select: {
          id: true, description: true, status: true, priority: true,
          resolvedAt: true, createdAt: true,
          customer: { select: { fullName: true, phone: true } },
          unit: {
            select: {
              code: true,
              building: {
                select: {
                  name: true,
                  phase: { select: { name: true, project: { select: { name: true } } } },
                },
              },
            },
          },
          category: { select: { name: true } },
          assignedAdmin: { select: { fullName: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // Compute installment totals per contract for the InstallmentPlans sheet
    const installmentTotals = new Map<string, { paid: number; total: number }>();
    for (const inst of installments) {
      const cn = inst.plan.contract.contractNumber ?? '';
      const prev = installmentTotals.get(cn) ?? { paid: 0, total: 0 };
      const amount = parseFloat(String(inst.amount));
      installmentTotals.set(cn, {
        paid: prev.paid + (inst.status === 'PAID' ? amount : 0),
        total: prev.total + amount,
      });
    }

    const wb = createReportWorkbook();
    const sheetCounts: Record<string, number> = {};

    // README added first so it is sheet 0; content is written after all data sheets
    const readmeWs = wb.addWorksheet('README');

    sheetCounts['Projects'] = this.buildProjects(wb, projects);
    sheetCounts['Phases'] = this.buildPhases(wb, phases);
    sheetCounts['Buildings'] = this.buildBuildings(wb, buildings);
    sheetCounts['Units'] = this.buildUnits(wb, units);
    sheetCounts['Customers'] = this.buildCustomers(wb, customers);
    sheetCounts['Leads'] = this.buildLeads(wb, leads);
    sheetCounts['Contracts'] = this.buildContracts(wb, contracts);
    sheetCounts['InstallmentPlans'] = this.buildInstallmentPlans(wb, installmentPlans, installmentTotals);
    sheetCounts['Installments'] = this.buildInstallments(wb, installments);
    sheetCounts['Deposits'] = this.buildDeposits(wb, deposits);
    sheetCounts['PaymentInstruments'] = this.buildPaymentInstruments(wb, instruments);
    sheetCounts['Refunds'] = this.buildRefunds(wb, refunds);
    sheetCounts['Brokers'] = this.buildBrokers(wb, brokers);
    sheetCounts['Commissions'] = this.buildCommissions(wb, commissions);
    sheetCounts['Maintenance'] = this.buildMaintenance(wb, maintenance);

    const totalRows = Object.values(sheetCounts).reduce((a, b) => a + b, 0);
    const companyName = company?.displayName ?? company?.name ?? companyId;
    const actorName = actor?.fullName ?? actorId;

    this.buildReadme(readmeWs, companyName, actorName, sheetCounts, totalRows, company?.currency ?? DEFAULT_CURRENCY);

    const buffer = await workbookToBuffer(wb);
    return { buffer, sheetCounts, totalRows, companyName };
  }

  // ── Sheet setup helpers ───────────────────────────────────────────────────

  private initSheet(wb: Workbook, name: string, headers: string[], widths: number[], tabColor = XLSX_TAB_CATALOG): Worksheet {
    if (widths.length !== headers.length) {
      throw new Error(
        `initSheet: widths.length (${widths.length}) !== headers.length (${headers.length}) for sheet "${name}". ` +
        `Add a width entry for every new column.`,
      );
    }
    const badIdx = widths.findIndex(w => typeof w !== 'number' || !Number.isFinite(w) || w <= 0);
    if (badIdx !== -1) {
      throw new Error(
        `initSheet: widths[${badIdx}] = ${widths[badIdx]} for sheet "${name}" — every width must be a finite positive number. ` +
        `Sparse array holes (,,) satisfy a length check but are typeof undefined and silently skipped by ExcelJS.`,
      );
    }
    const ws = wb.addWorksheet(name);
    ws.columns = headers.map((_, i) => ({ width: widths[i] }));
    const headerRow = ws.addRow(headers);
    headerRow.height = 22;
    headerRow.eachCell(styleHeaderCell);
    applySheetChrome(ws, { headerCount: headers.length, tabColor });
    return ws;
  }

  private writeRow(ws: Worksheet, rowIndex: number, cells: ExportCell[]): void {
    const row = ws.addRow(cells.map(() => null));
    cells.forEach((cell, colIdx) => {
      const c = row.getCell(colIdx + 1);
      c.border = HAIRLINE_BORDER;
      const isDate = cell.t === 'date' || cell.t === 'datetime';
      c.alignment = { horizontal: isDate ? 'center' : 'right', vertical: 'middle' };
      if (rowIndex % 2 === 1) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLSX_ZEBRA } };
      }
      this.applyCell(c, cell);
    });
  }

  private applyCell(c: Cell, cell: ExportCell): void {
    switch (cell.t) {
      case 'text':     writeTextCell(c, cell.v);     break;
      case 'date':     writeDateCell(c, cell.v);     break;
      case 'datetime': writeDateTimeCell(c, cell.v); break;
      case 'amount':   writeAmountCell(c, cell.v);   break;
      case 'int':      writeIntCell(c, cell.v);      break;
      case 'decimal':  writeDecimalCell(c, cell.v);  break;
    }
  }

  // ── Projects ─────────────────────────────────────────────────────────────
  // Timestamps (datetime, UTC): createdAt
  // Calendar dates: —

  private buildProjects(
    wb: Workbook,
    rows: Array<{ code: string | null; name: Prisma.JsonValue; description: Prisma.JsonValue; city: string; status: string; createdAt: Date }>,
  ): number {
    const ws = this.initSheet(wb, PROJECTS_SHEET.name, [...PROJECTS_SHEET.headers], [...PROJECTS_SHEET.widths], XLSX_TAB_CATALOG);
    rows.forEach((r, i) => {
      const name = tr(r.name);
      const desc = tr(r.description);
      this.writeRow(ws, i, [
        { t: 'text',     v: r.code },
        { t: 'text',     v: name.ar },
        { t: 'text',     v: name.en },
        { t: 'text',     v: desc.ar },
        { t: 'text',     v: desc.en },
        { t: 'text',     v: r.city },
        { t: 'text',     v: r.status },
        { t: 'datetime', v: r.createdAt },
      ]);
    });
    return rows.length;
  }

  // ── Phases ────────────────────────────────────────────────────────────────
  // Timestamps (datetime, UTC): createdAt
  // Calendar dates: —
  // Integers: order

  private buildPhases(
    wb: Workbook,
    rows: Array<{ code: string | null; name: Prisma.JsonValue; order: number; createdAt: Date; project: { code: string | null; name: Prisma.JsonValue } }>,
  ): number {
    const ws = this.initSheet(wb, PHASES_SHEET.name, [...PHASES_SHEET.headers], [...PHASES_SHEET.widths], XLSX_TAB_CATALOG);
    rows.forEach((r, i) => {
      const proj = tr(r.project.name);
      const phase = tr(r.name);
      this.writeRow(ws, i, [
        { t: 'text',     v: r.project.code },
        { t: 'text',     v: proj.ar },
        { t: 'text',     v: proj.en },
        { t: 'text',     v: r.code },
        { t: 'text',     v: phase.ar },
        { t: 'text',     v: phase.en },
        { t: 'int',      v: r.order },
        { t: 'datetime', v: r.createdAt },
      ]);
    });
    return rows.length;
  }

  // ── Buildings ─────────────────────────────────────────────────────────────
  // Timestamps (datetime, UTC): createdAt
  // Calendar dates: —
  // Integers: order, totalFloors

  private buildBuildings(
    wb: Workbook,
    rows: Array<{
      code: string | null; name: string; totalFloors: number; order: number; createdAt: Date;
      phase: { code: string | null; name: Prisma.JsonValue; project: { code: string | null; name: Prisma.JsonValue } };
    }>,
  ): number {
    const ws = this.initSheet(wb, BUILDINGS_SHEET.name, [...BUILDINGS_SHEET.headers], [...BUILDINGS_SHEET.widths], XLSX_TAB_CATALOG);
    rows.forEach((r, i) => {
      const proj = tr(r.phase.project.name);
      const phase = tr(r.phase.name);
      this.writeRow(ws, i, [
        { t: 'text',     v: r.phase.project.code },
        { t: 'text',     v: proj.ar },
        { t: 'text',     v: proj.en },
        { t: 'text',     v: r.phase.code },
        { t: 'text',     v: phase.ar },
        { t: 'text',     v: phase.en },
        { t: 'text',     v: r.code },
        { t: 'text',     v: r.name },
        { t: 'int',      v: r.order },
        { t: 'int',      v: r.totalFloors },
        { t: 'datetime', v: r.createdAt },
      ]);
    });
    return rows.length;
  }

  // ── Units ─────────────────────────────────────────────────────────────────
  // Timestamps (datetime, UTC): createdAt
  // Calendar dates: —
  // Integers: floor, bedrooms, bathrooms
  // Decimals: area

  private buildUnits(
    wb: Workbook,
    rows: Array<{
      code: string; type: string; floor: number; area: number;
      bedrooms: number; bathrooms: number; price: Prisma.Decimal;
      status: string; createdAt: Date;
      building: { code: string | null; name: string; phase: { code: string | null; name: Prisma.JsonValue; project: { code: string | null; name: Prisma.JsonValue } } };
    }>,
  ): number {
    const ws = this.initSheet(wb, UNITS_SHEET.name, [...UNITS_SHEET.headers], [...UNITS_SHEET.widths], XLSX_TAB_CATALOG);
    rows.forEach((r, i) => {
      const proj = tr(r.building.phase.project.name);
      const phase = tr(r.building.phase.name);
      this.writeRow(ws, i, [
        { t: 'text',     v: r.building.phase.project.code },
        { t: 'text',     v: proj.ar },
        { t: 'text',     v: proj.en },
        { t: 'text',     v: r.building.phase.code },
        { t: 'text',     v: phase.ar },
        { t: 'text',     v: phase.en },
        { t: 'text',     v: r.building.code },
        { t: 'text',     v: r.building.name },
        { t: 'text',     v: r.code },
        { t: 'text',     v: r.type },
        { t: 'int',      v: r.floor },
        { t: 'decimal',  v: r.area },
        { t: 'int',      v: r.bedrooms },
        { t: 'int',      v: r.bathrooms },
        { t: 'amount',   v: r.price },
        { t: 'text',     v: r.status },
        { t: 'datetime', v: r.createdAt },
      ]);
    });
    return rows.length;
  }

  // ── Customers ─────────────────────────────────────────────────────────────
  // Timestamps (datetime, UTC): createdAt
  // Calendar dates: —

  private buildCustomers(
    wb: Workbook,
    rows: Array<{ fullName: string; phone: string | null; email: string | null; locale: string; createdAt: Date }>,
  ): number {
    const headers = ['الاسم الكامل', 'الهاتف', 'البريد الإلكتروني', 'اللغة المفضلة', 'تاريخ التسجيل (UTC)'];
    const ws = this.initSheet(wb, 'Customers', headers, [30, 18, 30, 14, 22], XLSX_TAB_PEOPLE);
    rows.forEach((r, i) => {
      this.writeRow(ws, i, [
        { t: 'text',     v: r.fullName },
        { t: 'text',     v: storedToImportPhone(r.phone) ?? r.phone },
        { t: 'text',     v: r.email },
        { t: 'text',     v: r.locale },
        { t: 'datetime', v: r.createdAt },
      ]);
    });
    return rows.length;
  }

  // ── Leads ─────────────────────────────────────────────────────────────────
  // Timestamps (datetime, UTC): createdAt, updatedAt
  // Calendar dates: —

  private buildLeads(
    wb: Workbook,
    rows: Array<{
      id: string; fullName: string; phone: string; email: string | null;
      stage: string; createdAt: Date; updatedAt: Date;
      source: { name: Prisma.JsonValue } | null;
      assignedSales: { fullName: string } | null;
      projectInterest: { name: Prisma.JsonValue } | null;
      unitInterest: { code: string } | null;
    }>,
  ): number {
    const headers = ['_ImportId', '_Ref', 'الاسم الكامل', 'الهاتف', 'البريد الإلكتروني', 'المرحلة', 'المصدر', 'مندوب المبيعات', 'المشروع المهتم (AR)', 'المشروع المهتم (EN)', 'كود الوحدة المهتمة', 'تاريخ الإضافة (UTC)', 'آخر تحديث (UTC)'];
    const ws = this.initSheet(wb, 'Leads', headers, [38, 10, 25, 16, 28, 14, 18, 22, 25, 25, 14, 22, 22], XLSX_TAB_PEOPLE);
    rows.forEach((r, i) => {
      const projInterest = r.projectInterest ? tr(r.projectInterest.name) : { ar: '', en: '' };
      const sourceName = r.source ? tr(r.source.name) : { ar: '', en: '' };
      this.writeRow(ws, i, [
        { t: 'text',     v: r.id },
        { t: 'text',     v: shortRef(r.id) },
        { t: 'text',     v: r.fullName },
        { t: 'text',     v: storedToImportPhone(r.phone) ?? r.phone },
        { t: 'text',     v: r.email },
        { t: 'text',     v: r.stage },
        { t: 'text',     v: sourceName.ar || sourceName.en || null },
        { t: 'text',     v: r.assignedSales?.fullName ?? null },
        { t: 'text',     v: projInterest.ar },
        { t: 'text',     v: projInterest.en },
        { t: 'text',     v: r.unitInterest?.code ?? null },
        { t: 'datetime', v: r.createdAt },
        { t: 'datetime', v: r.updatedAt },
      ]);
    });
    return rows.length;
  }

  // ── Contracts ─────────────────────────────────────────────────────────────
  // Timestamps (datetime, UTC): createdAt
  // Calendar dates: signedAt, cancellationDate

  private buildContracts(
    wb: Workbook,
    rows: Array<{
      contractNumber: string | null; totalAmount: Prisma.Decimal;
      downPayment: Prisma.Decimal; status: string;
      signedAt: Date | null; createdAt: Date;
      customer: { phone: string | null; fullName: string };
      unit: { code: string; building: { name: string; phase: { name: Prisma.JsonValue; project: { name: Prisma.JsonValue } } } };
      cancellation: {
        cancellationDate: Date; reason: string;
        retainedAmount: Prisma.Decimal; refundAmount: Prisma.Decimal;
        cancelledBy: { fullName: string };
      } | null;
    }>,
  ): number {
    const headers = [
      'رقم العقد', 'هاتف العميل', 'اسم العميل',
      'اسم المشروع (AR)', 'اسم المشروع (EN)',
      'اسم المرحلة (AR)', 'اسم المرحلة (EN)',
      'المبنى', 'كود الوحدة',
      'إجمالي المبلغ', 'الدفعة المقدمة', 'الحالة',
      'تاريخ التوقيع', 'تاريخ الإضافة (UTC)',
      'تاريخ الإلغاء', 'سبب الإلغاء', 'مبلغ محتجز', 'مبلغ مُرتجع', 'بواسطة',
    ];
    const ws = this.initSheet(wb, 'Contracts', headers, [16, 16, 25, 25, 25, 22, 22, 18, 14, 16, 16, 14, 15, 22, 15, 30, 14, 14, 22], XLSX_TAB_FINANCIAL);
    rows.forEach((r, i) => {
      const proj = tr(r.unit.building.phase.project.name);
      const phase = tr(r.unit.building.phase.name);
      this.writeRow(ws, i, [
        { t: 'text',     v: r.contractNumber },
        { t: 'text',     v: r.customer.phone },
        { t: 'text',     v: r.customer.fullName },
        { t: 'text',     v: proj.ar },
        { t: 'text',     v: proj.en },
        { t: 'text',     v: phase.ar },
        { t: 'text',     v: phase.en },
        { t: 'text',     v: r.unit.building.name },
        { t: 'text',     v: r.unit.code },
        { t: 'amount',   v: r.totalAmount },
        { t: 'amount',   v: r.downPayment },
        { t: 'text',     v: r.status },
        { t: 'date',     v: r.signedAt },
        { t: 'datetime', v: r.createdAt },
        { t: 'date',     v: r.cancellation?.cancellationDate ?? null },
        { t: 'text',     v: r.cancellation?.reason ?? null },
        { t: 'amount',   v: r.cancellation?.retainedAmount ?? null },
        { t: 'amount',   v: r.cancellation?.refundAmount ?? null },
        { t: 'text',     v: r.cancellation?.cancelledBy.fullName ?? null },
      ]);
    });
    return rows.length;
  }

  // ── InstallmentPlans ──────────────────────────────────────────────────────
  // Timestamps (datetime, UTC): —
  // Calendar dates: startsAt
  // Integers: totalMonths

  private buildInstallmentPlans(
    wb: Workbook,
    rows: Array<{
      totalMonths: number; monthlyAmount: Prisma.Decimal;
      startsAt: Date; frequency: string; createdAt: Date;
      contract: { contractNumber: string | null };
    }>,
    totals: Map<string, { paid: number; total: number }>,
  ): number {
    const headers = ['رقم العقد', 'عدد الأقساط', 'قيمة القسط الشهري', 'تاريخ البدء', 'التكرار', 'المدفوع', 'الرصيد المتبقي'];
    const ws = this.initSheet(wb, 'InstallmentPlans', headers, [16, 14, 20, 15, 14, 16, 16], XLSX_TAB_FINANCIAL);
    rows.forEach((r, i) => {
      const cn = r.contract.contractNumber ?? '';
      const t = totals.get(cn) ?? { paid: 0, total: 0 };
      this.writeRow(ws, i, [
        { t: 'text',   v: r.contract.contractNumber },
        { t: 'int',    v: r.totalMonths },
        { t: 'amount', v: r.monthlyAmount },
        { t: 'date',   v: r.startsAt },
        { t: 'text',   v: r.frequency },
        { t: 'amount', v: t.paid },
        { t: 'amount', v: t.total - t.paid },
      ]);
    });
    return rows.length;
  }

  // ── Installments ──────────────────────────────────────────────────────────
  // Timestamps (datetime, UTC): paidAt
  // Calendar dates: dueDate
  // Integers: ordinal (#)

  private buildInstallments(
    wb: Workbook,
    rows: Array<{
      dueDate: Date; amount: Prisma.Decimal; status: string;
      paidAt: Date | null; type: string;
      plan: { contract: { contractNumber: string | null; customer: { phone: string | null }; unit: { code: string } } };
    }>,
  ): number {
    const headers = ['رقم العقد', 'هاتف العميل', 'كود الوحدة', '#', 'النوع', 'تاريخ الاستحقاق', 'المبلغ', 'الحالة', 'تاريخ الدفع (UTC)'];
    const ws = this.initSheet(wb, 'Installments', headers, [16, 16, 14, 8, 14, 15, 14, 14, 22], XLSX_TAB_FINANCIAL);

    const ordinals = new Map<string, number>();
    rows.forEach((r, i) => {
      const cn = r.plan.contract.contractNumber ?? '';
      const ord = (ordinals.get(cn) ?? 0) + 1;
      ordinals.set(cn, ord);
      this.writeRow(ws, i, [
        { t: 'text',     v: r.plan.contract.contractNumber },
        { t: 'text',     v: r.plan.contract.customer.phone },
        { t: 'text',     v: r.plan.contract.unit.code },
        { t: 'int',      v: ord },
        { t: 'text',     v: r.type },
        { t: 'date',     v: r.dueDate },
        { t: 'amount',   v: r.amount },
        { t: 'text',     v: r.status },
        { t: 'datetime', v: r.paidAt },
      ]);
    });
    return rows.length;
  }

  // ── Deposits ──────────────────────────────────────────────────────────────
  // Timestamps (datetime, UTC): paidAt
  // Calendar dates: —

  private buildDeposits(
    wb: Workbook,
    rows: Array<{
      id: string; type: string; amount: Prisma.Decimal;
      paidAt: Date; reviewStatus: string; paymentMethod: string | null;
      contract: { contractNumber: string | null; customer: { phone: string | null; fullName: string } } | null;
      installment: { plan: { contract: { contractNumber: string | null; customer: { phone: string | null; fullName: string } } } } | null;
      paymentInstrument: { id: string } | null;
      recordedBy: { fullName: string };
    }>,
  ): number {
    const headers = ['_Ref', 'النوع', 'رقم العقد', 'هاتف العميل', 'اسم العميل', 'المبلغ', 'طريقة الدفع', 'تاريخ الدفع (UTC)', 'حالة المراجعة', 'مرجع الأداة', 'سجّل بواسطة'];
    const ws = this.initSheet(wb, 'Deposits', headers, [10, 14, 16, 16, 25, 14, 16, 22, 16, 10, 22], XLSX_TAB_PAYMENTS);
    rows.forEach((r, i) => {
      // Resolve the customer + contract number — deposit can be direct on contract
      // or via an installment, depending on DepositType.
      const contractNumber = r.contract?.contractNumber ?? r.installment?.plan.contract.contractNumber ?? null;
      const customerPhone = r.contract?.customer.phone ?? r.installment?.plan.contract.customer.phone ?? null;
      const customerName = r.contract?.customer.fullName ?? r.installment?.plan.contract.customer.fullName ?? null;
      this.writeRow(ws, i, [
        { t: 'text',     v: shortRef(r.id) },
        { t: 'text',     v: r.type },
        { t: 'text',     v: contractNumber },
        { t: 'text',     v: customerPhone },
        { t: 'text',     v: customerName },
        { t: 'amount',   v: r.amount },
        { t: 'text',     v: r.paymentMethod },
        { t: 'datetime', v: r.paidAt },
        { t: 'text',     v: r.reviewStatus },
        { t: 'text',     v: r.paymentInstrument ? shortRef(r.paymentInstrument.id) : null },
        { t: 'text',     v: r.recordedBy.fullName },
      ]);
    });
    return rows.length;
  }

  // ── PaymentInstruments ────────────────────────────────────────────────────
  // Timestamps (datetime, UTC): createdAt
  // Calendar dates: chequeDueDate, clearingDate, bounceDate

  private buildPaymentInstruments(
    wb: Workbook,
    rows: Array<{
      id: string; type: string; status: string;
      chequeNumber: string | null; drawerBankName: string | null;
      bankName: string | null; referenceNumber: string | null;
      chequeDueDate: Date | null; clearingDate: Date | null;
      bounceReason: string | null; bounceDate: Date | null;
      createdAt: Date; replacedById: string | null;
      deposits: Array<{
        contract: { contractNumber: string | null } | null;
        installment: { plan: { contract: { contractNumber: string | null } } } | null;
      }>;
      recordedBy: { fullName: string };
    }>,
  ): number {
    const headers = ['_Ref', 'النوع', 'الحالة', 'أرقام العقود', 'رقم الشيك', 'البنك', 'رقم المرجع', 'تاريخ الاستحقاق', 'تاريخ التحصيل', 'سبب الإرتجاع', 'تاريخ الإرتجاع', 'تم الاستبدال بـ', 'سجّل بواسطة', 'تاريخ الإضافة (UTC)'];
    const ws = this.initSheet(wb, 'PaymentInstruments', headers, [10, 16, 16, 22, 14, 22, 18, 15, 15, 30, 15, 10, 22, 22], XLSX_TAB_PAYMENTS);
    rows.forEach((r, i) => {
      // Collect unique contract numbers from linked deposits
      const contractNums = [...new Set(
        r.deposits.map(d =>
          d.contract?.contractNumber ?? d.installment?.plan.contract.contractNumber ?? null
        ).filter(Boolean)
      )].join(', ');
      this.writeRow(ws, i, [
        { t: 'text',     v: shortRef(r.id) },
        { t: 'text',     v: r.type },
        { t: 'text',     v: r.status },
        { t: 'text',     v: contractNums || null },
        { t: 'text',     v: r.chequeNumber },
        { t: 'text',     v: r.drawerBankName ?? r.bankName },
        { t: 'text',     v: r.referenceNumber },
        { t: 'date',     v: r.chequeDueDate },
        { t: 'date',     v: r.clearingDate },
        { t: 'text',     v: r.bounceReason },
        { t: 'date',     v: r.bounceDate },
        { t: 'text',     v: r.replacedById ? shortRef(r.replacedById) : null },
        { t: 'text',     v: r.recordedBy.fullName },
        { t: 'datetime', v: r.createdAt },
      ]);
    });
    return rows.length;
  }

  // ── Refunds ───────────────────────────────────────────────────────────────
  // Timestamps (datetime, UTC): paidAt
  // Calendar dates: cancellationDate

  private buildRefunds(
    wb: Workbook,
    rows: Array<{
      id: string; amount: Prisma.Decimal; paymentMethod: string;
      referenceNumber: string | null; bankName: string | null; paidAt: Date;
      cancellation: {
        cancellationDate: Date;
        contract: { contractNumber: string | null; customer: { phone: string | null; fullName: string } };
      };
      recordedBy: { fullName: string };
    }>,
  ): number {
    const headers = ['_Ref', 'رقم العقد', 'هاتف العميل', 'اسم العميل', 'تاريخ الإلغاء', 'المبلغ المُرتجع', 'طريقة الدفع', 'رقم المرجع', 'البنك', 'تاريخ الصرف (UTC)', 'سجّل بواسطة'];
    const ws = this.initSheet(wb, 'Refunds', headers, [10, 16, 16, 25, 15, 14, 16, 18, 22, 22, 22], XLSX_TAB_PAYMENTS);
    rows.forEach((r, i) => {
      this.writeRow(ws, i, [
        { t: 'text',     v: shortRef(r.id) },
        { t: 'text',     v: r.cancellation.contract.contractNumber },
        { t: 'text',     v: r.cancellation.contract.customer.phone },
        { t: 'text',     v: r.cancellation.contract.customer.fullName },
        { t: 'date',     v: r.cancellation.cancellationDate },
        { t: 'amount',   v: r.amount },
        { t: 'text',     v: r.paymentMethod },
        { t: 'text',     v: r.referenceNumber },
        { t: 'text',     v: r.bankName },
        { t: 'datetime', v: r.paidAt },
        { t: 'text',     v: r.recordedBy.fullName },
      ]);
    });
    return rows.length;
  }

  // ── Brokers ───────────────────────────────────────────────────────────────
  // Timestamps (datetime, UTC): createdAt
  // Calendar dates: —

  private buildBrokers(
    wb: Workbook,
    rows: Array<{
      code: string; companyName: string; taxId: string | null;
      phone: string | null; email: string | null; city: string | null;
      defaultCommissionPct: Prisma.Decimal; status: string; createdAt: Date;
    }>,
  ): number {
    const headers = ['كود الوسيط', 'اسم الشركة', 'الرقم الضريبي', 'الهاتف', 'البريد الإلكتروني', 'المدينة', 'نسبة العمولة الافتراضية %', 'الحالة', 'تاريخ الإضافة (UTC)'];
    const ws = this.initSheet(wb, 'Brokers', headers, [14, 28, 16, 16, 28, 15, 22, 14, 22], XLSX_TAB_BROKERS);
    rows.forEach((r, i) => {
      this.writeRow(ws, i, [
        { t: 'text',     v: r.code },
        { t: 'text',     v: r.companyName },
        { t: 'text',     v: r.taxId },
        { t: 'text',     v: r.phone },
        { t: 'text',     v: r.email },
        { t: 'text',     v: r.city },
        { t: 'amount',   v: r.defaultCommissionPct },
        { t: 'text',     v: r.status },
        { t: 'datetime', v: r.createdAt },
      ]);
    });
    return rows.length;
  }

  // ── Commissions ───────────────────────────────────────────────────────────
  // Timestamps (datetime, UTC): earnedAt, clawbackAt
  // Calendar dates: —

  private buildCommissions(
    wb: Workbook,
    rows: Array<{
      commissionNumber: string; basisAmount: Prisma.Decimal;
      commissionPct: Prisma.Decimal | null; grossAmount: Prisma.Decimal;
      netAmount: Prisma.Decimal; status: string; earnedAt: Date;
      clawbackStatus: string | null; clawbackAt: Date | null;
      clawbackCollectedAmount: Prisma.Decimal | null;
      contract: { contractNumber: string | null; customer: { phone: string | null } };
      unit: { code: string };
      project: { name: Prisma.JsonValue };
      broker: { code: string; companyName: string };
    }>,
  ): number {
    const headers = [
      'رقم العمولة', 'رقم العقد', 'هاتف العميل', 'كود الوحدة',
      'اسم المشروع (AR)', 'اسم المشروع (EN)',
      'كود الوسيط', 'شركة الوسيط',
      'مبلغ الأساس', 'نسبة العمولة %', 'الإجمالي', 'صافي العمولة',
      'الحالة', 'تاريخ الاستحقاق (UTC)',
      'حالة الاسترداد', 'تاريخ الاسترداد (UTC)', 'مبلغ الاسترداد',
    ];
    const ws = this.initSheet(wb, 'Commissions', headers, [16, 16, 16, 14, 25, 25, 14, 25, 14, 14, 14, 14, 14, 22, 16, 22, 14], XLSX_TAB_BROKERS);
    rows.forEach((r, i) => {
      const proj = tr(r.project.name);
      this.writeRow(ws, i, [
        { t: 'text',     v: r.commissionNumber },
        { t: 'text',     v: r.contract.contractNumber },
        { t: 'text',     v: r.contract.customer.phone },
        { t: 'text',     v: r.unit.code },
        { t: 'text',     v: proj.ar },
        { t: 'text',     v: proj.en },
        { t: 'text',     v: r.broker.code },
        { t: 'text',     v: r.broker.companyName },
        { t: 'amount',   v: r.basisAmount },
        { t: 'amount',   v: r.commissionPct },
        { t: 'amount',   v: r.grossAmount },
        { t: 'amount',   v: r.netAmount },
        { t: 'text',     v: r.status },
        { t: 'datetime', v: r.earnedAt },
        { t: 'text',     v: r.clawbackStatus },
        { t: 'datetime', v: r.clawbackAt },
        { t: 'amount',   v: r.clawbackCollectedAmount },
      ]);
    });
    return rows.length;
  }

  // ── Maintenance ───────────────────────────────────────────────────────────
  // Timestamps (datetime, UTC): createdAt, resolvedAt
  // Calendar dates: —

  private buildMaintenance(
    wb: Workbook,
    rows: Array<{
      id: string; description: string; status: string;
      priority: string | null; resolvedAt: Date | null; createdAt: Date;
      customer: { fullName: string; phone: string | null };
      unit: { code: string; building: { name: string; phase: { name: Prisma.JsonValue; project: { name: Prisma.JsonValue } } } };
      category: { name: Prisma.JsonValue };
      assignedAdmin: { fullName: string } | null;
    }>,
  ): number {
    const headers = ['_Ref', 'كود الوحدة', 'اسم المشروع (AR)', 'اسم المشروع (EN)', 'اسم المرحلة (AR)', 'اسم المرحلة (EN)', 'المبنى', 'اسم العميل', 'هاتف العميل', 'التصنيف (AR)', 'التصنيف (EN)', 'الوصف', 'الأولوية', 'الحالة', 'مسؤول الصيانة', 'تاريخ الإضافة (UTC)', 'تاريخ الحل (UTC)'];
    const ws = this.initSheet(wb, 'Maintenance', headers, [10, 14, 25, 25, 22, 22, 18, 25, 16, 20, 20, 35, 12, 14, 22, 22, 22], XLSX_TAB_OPS);
    rows.forEach((r, i) => {
      const proj = tr(r.unit.building.phase.project.name);
      const phase = tr(r.unit.building.phase.name);
      const cat = tr(r.category.name);
      this.writeRow(ws, i, [
        { t: 'text',     v: shortRef(r.id) },
        { t: 'text',     v: r.unit.code },
        { t: 'text',     v: proj.ar },
        { t: 'text',     v: proj.en },
        { t: 'text',     v: phase.ar },
        { t: 'text',     v: phase.en },
        { t: 'text',     v: r.unit.building.name },
        { t: 'text',     v: r.customer.fullName },
        { t: 'text',     v: r.customer.phone },
        { t: 'text',     v: cat.ar },
        { t: 'text',     v: cat.en },
        { t: 'text',     v: r.description },
        { t: 'text',     v: r.priority },
        { t: 'text',     v: r.status },
        { t: 'text',     v: r.assignedAdmin?.fullName ?? null },
        { t: 'datetime', v: r.createdAt },
        { t: 'datetime', v: r.resolvedAt },
      ]);
    });
    return rows.length;
  }

  // ── README cover sheet ────────────────────────────────────────────────────

  private buildReadme(
    ws: Worksheet,
    companyName: string,
    actorName: string,
    sheetCounts: Record<string, number>,
    totalRows: number,
    currency: string,
  ): void {
    // 4 columns: [label/sheet, content, content, count]
    ws.columns = [{ width: 24 }, { width: 28 }, { width: 24 }, { width: 14 }];
    ws.views = [{ rightToLeft: true, showGridLines: false }];
    ws.properties.tabColor = { argb: XLSX_TAB_README };
    ws.pageSetup = {
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    };

    const SPAN = 4; // number of columns
    const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

    // ── Row 1: title banner ──────────────────────────────────────────────────
    ws.mergeCells(1, 1, 1, SPAN);
    for (let c = 1; c <= SPAN; c++) {
      ws.getCell(1, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLSX_NAVY } };
    }
    const titleCell = ws.getCell(1, 1);
    titleCell.value = companyName;
    titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { horizontal: 'right', vertical: 'middle' };
    ws.getRow(1).height = 38;

    // ── Row 2: subtitle ──────────────────────────────────────────────────────
    ws.mergeCells(2, 1, 2, SPAN);
    const subtitleCell = ws.getCell(2, 1);
    subtitleCell.value = 'تصدير بيانات كامل  |  Full Data Export';
    subtitleCell.font = { size: 10, color: { argb: XLSX_MUTED } };
    subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLSX_META_FILL } };
    subtitleCell.alignment = { horizontal: 'right', vertical: 'middle' };
    ws.getRow(2).height = 20;

    // ── Row 3: spacer ────────────────────────────────────────────────────────
    ws.addRow([]);

    // ── Rows 4-7: metadata block ─────────────────────────────────────────────
    const metaRows: Array<[string, string]> = [
      ['الشركة', companyName],
      ['تاريخ التصدير', stamp],
      ['صادر بواسطة', actorName],
      ['إصدار التنسيق', 'v1'],
      // Amount columns hold plain numbers (re-importable); this is their currency.
      ['العملة (لكل المبالغ)', currencyNote(currency).replace('العملة: ', '')],
    ];
    for (const [lbl, val] of metaRows) {
      const r = ws.addRow([lbl]);
      const rn = r.number;
      ws.mergeCells(rn, 2, rn, SPAN);
      const lc = ws.getCell(rn, 1);
      lc.font = { bold: true, size: 10, color: { argb: XLSX_NAVY } };
      lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLSX_META_FILL } };
      lc.alignment = { horizontal: 'right', vertical: 'middle' };
      const vc = ws.getCell(rn, 2);
      vc.value = val;
      vc.font = { size: 10, color: { argb: XLSX_NAVY } };
      vc.alignment = { horizontal: 'right', vertical: 'middle' };
      r.height = 18;
    }

    // ── spacer ───────────────────────────────────────────────────────────────
    ws.addRow([]);

    // ── Inventory table header ───────────────────────────────────────────────
    const tblHeaderRow = ws.addRow(['الشيت', 'المحتوى', '', 'عدد الصفوف']);
    ws.mergeCells(tblHeaderRow.number, 2, tblHeaderRow.number, 3);
    tblHeaderRow.height = 20;
    tblHeaderRow.eachCell((cell) => {
      cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLSX_NAVY } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // ── Inventory table rows ─────────────────────────────────────────────────
    const sheetOrder: Array<[string, string]> = [
      ['Projects',          'المشاريع — الأسماء، المدينة، الحالة'],
      ['Phases',            'المراحل وارتباطها بالمشاريع'],
      ['Buildings',         'المباني وارتباطها بالمراحل'],
      ['Units',             'الوحدات — النوع، الطابق، السعر، الحالة'],
      ['Customers',         'العملاء (CLIENT) المسجّلون في التطبيق'],
      ['Leads',             'فرص المبيعات — المرحلة، المصدر، المندوب'],
      ['Contracts',         'العقود — الإجمالي، الدفعة المقدمة، الإلغاء'],
      ['InstallmentPlans',  'خطط التقسيط — عدد الأقساط، القيمة الشهرية'],
      ['Installments',      'الأقساط الفردية — تاريخ الاستحقاق، الحالة'],
      ['Deposits',          'الدفعات المدفوعة — النوع، المبلغ، المراجعة'],
      ['PaymentInstruments','أدوات الدفع — الشيكات والتحويلات'],
      ['Refunds',           'المبالغ المُرتجعة من عقود مُلغاة'],
      ['Brokers',           'الوسطاء — الشركات، العمولات الافتراضية'],
      ['Commissions',       'عمولات الوسطاء — الإجمالي، الصافي، الاسترداد'],
      ['Maintenance',       'طلبات الصيانة — الأولوية، الحالة، الحل'],
    ];

    sheetOrder.forEach(([sheetName, desc], idx) => {
      const count = sheetCounts[sheetName] ?? 0;
      const dataRow = ws.addRow([null, desc, '', count]);
      const rn = dataRow.number;

      // Hyperlink in col A
      ws.mergeCells(rn, 2, rn, 3);
      const linkCell = ws.getCell(rn, 1);
      linkCell.value = { text: sheetName, hyperlink: `#${sheetName}!A1` };
      linkCell.font = { size: 10, color: { argb: 'FF1E6FBF' }, underline: true };
      linkCell.alignment = { horizontal: 'right', vertical: 'middle' };

      const descCell = ws.getCell(rn, 2);
      descCell.font = { size: 10, color: { argb: XLSX_MUTED } };
      descCell.alignment = { horizontal: 'right', vertical: 'middle' };

      const countCell = ws.getCell(rn, 4);
      countCell.font = { size: 10, color: { argb: XLSX_NAVY } };
      countCell.numFmt = '#,##0';
      countCell.alignment = { horizontal: 'center', vertical: 'middle' };

      // Zebra stripe
      if (idx % 2 === 1) {
        for (let c = 1; c <= SPAN; c++) {
          const cell = ws.getCell(rn, c);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLSX_ZEBRA } };
        }
      }
      dataRow.height = 18;
    });

    // ── Totals row ───────────────────────────────────────────────────────────
    const totalsRow = ws.addRow(['الإجمالي', '', '', totalRows]);
    const tn = totalsRow.number;
    ws.mergeCells(tn, 1, tn, 3);
    for (let c = 1; c <= SPAN; c++) {
      const cell = ws.getCell(tn, c);
      cell.font = { bold: true, size: 10, color: { argb: XLSX_NAVY } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLSX_GOLD_COVER } };
      cell.border = { top: { style: 'medium', color: { argb: XLSX_NAVY } } };
    }
    ws.getCell(tn, 4).numFmt = '#,##0';
    ws.getCell(tn, 4).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell(tn, 1).alignment = { horizontal: 'right', vertical: 'middle' };
    totalsRow.height = 20;

    // ── spacer ───────────────────────────────────────────────────────────────
    ws.addRow([]);

    // ── Notes section ────────────────────────────────────────────────────────
    const noteHeading = ws.addRow(['ملاحظات مهمة']);
    const nh = noteHeading.number;
    ws.mergeCells(nh, 1, nh, SPAN);
    const nhCell = ws.getCell(nh, 1);
    nhCell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    nhCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLSX_NAVY } };
    nhCell.alignment = { horizontal: 'right', vertical: 'middle' };
    noteHeading.height = 22;

    const notes = [
      'أعمدة _Ref و_ImportId هي معرّفات النظام — لا تحذفها ولا تعدّلها. يمكن إخفاؤها.',
      'أرقام الهاتف والمعرّفات الرقمية محفوظة كنص. لا تُعيد تنسيقها كأرقام.',
      'أعمدة _Code و_ProjectCode و_PhaseCode و_BuildingCode محفوظة كنص. عند إعادة فتح الملف في Excel تأكد أن هذه الأعمدة منسّقة كـ "نص" (Text) لتجنب فقدان الأصفار البادئة في الأكواد الرقمية.',
      'الخلية الفارغة تعني: لا توجد قيمة. لا تُميَّز عن النص الفارغ.',
      'كل الأوقات بتوقيت UTC. الأعمدة ذات اللاحقة (UTC) تحتوي وقتاً كاملاً.',
      'هذا الملف يحتوي بيانات سرية. لا تشاركه خارج مؤسستك.',
      'المستورد يدعم أرقام الهاتف المصرية فقط (+20 / 01XXXXXXXXX). أي رقم بمقدمة دولة غير مصرية (+966 و+1 وغيرها) سيُرفض بخطأ واضح. راجع ملاحظة FG-21 لمتطلبات الدول الأخرى.',
    ];

    // Column widths are [24, 28, 24, 14] = 90 Excel units.  At 9pt Arabic font,
    // roughly 82 characters fit per line — validated against notes 3 and 7 (185
    // and 167 chars) which each need 3 wrapped lines.
    const NOTE_CHARS_PER_LINE = 82;
    const NOTE_LINE_HEIGHT_PT = 14; // 9pt font + leading

    notes.forEach((note, idx) => {
      const bulletNote = `• ${note}`;
      const lines = Math.max(1, Math.ceil(bulletNote.length / NOTE_CHARS_PER_LINE));
      const nr = ws.addRow([bulletNote]);
      const n = nr.number;
      ws.mergeCells(n, 1, n, SPAN);
      const nc = ws.getCell(n, 1);
      nc.font = { size: 9, color: { argb: XLSX_MUTED } };
      nc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'FFFFFFFF' : XLSX_ZEBRA } };
      nc.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true };
      nr.height = Math.max(28, lines * NOTE_LINE_HEIGHT_PT + 4);
    });
  }
}
