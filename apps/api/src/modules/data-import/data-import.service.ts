import { BadRequestException, Injectable } from '@nestjs/common';
import { Workbook, ValueType } from 'exceljs';
import type { Prisma } from '@prisma/client';
import { LeadStage, Locale, ProjectStatus, ReservationStatus, UnitStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  PROJECTS_SHEET,
  PHASES_SHEET,
  BUILDINGS_SHEET,
  UNITS_SHEET,
  CUSTOMERS_SHEET,
  LEADS_SHEET,
} from '../../common/utils/import-headers';
import { ENTITY_CODE_PATTERN } from '../../common/utils/entity-code';
import { normalizePhone, storedToImportPhone } from '../../common/utils/phone-normaliser';
import { canonicalPhone } from '../../common/utils/identity-normalize';
import type {
  ImportPlan,
  ImportResult,
  ImportError,
  ImportWarning,
  ProjectPlan,
  PhasePlan,
  BuildingPlan,
  UnitPlan,
  CustomerPlan,
  LeadPlan,
  SheetPlan,
  ImportOp,
} from './data-import.types';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_ERRORS = 50;
// provisional guard, NOT measured — tune based on real performance benchmarks
const MAX_ROWS = 2000;

// UUID v4 pattern — used to validate _ImportId cells in the Leads sheet
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── DB-preload types ──────────────────────────────────────────────────────────

interface DbProject {
  id: string;
  code: string;
  city: string;
  status: ProjectStatus;
  nameAr: string | null;
  nameEn: string | null;
  descAr: string | null;
  descEn: string | null;
  updatedAt: Date;
}

interface DbPhase {
  id: string;
  code: string;
  projectId: string;
  order: number;
  nameAr: string | null;
  nameEn: string | null;
}

interface DbBuilding {
  id: string;
  code: string;
  phaseId: string;
  name: string;
  order: number;
  totalFloors: number;
}

interface DbUnit {
  id: string;
  code: string;
  buildingId: string;
  type: string;
  floor: number;
  area: number;
  bedrooms: number;
  bathrooms: number;
  price: number;
  status: UnitStatus;
  updatedAt: Date;
}

interface DbClient {
  id: string;
  phone: string;
  fullName: string;
  email: string | null;
  locale: Locale;
  updatedAt: Date;
}

interface DbLead {
  id: string;
  phone: string;
  clientId: string;
  fullName: string;
  stage: LeadStage;
  sourceId: string | null;
  assignedSalesId: string | null;
  projectInterestId: string | null;
  unitInterestId: string | null;
  updatedAt: Date;
}

// ── Local helpers ─────────────────────────────────────────────────────────────

function trJson(value: unknown): { ar: string | null; en: string | null } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ar: null, en: null };
  const obj = value as Record<string, unknown>;
  return {
    ar: obj.ar != null ? String(obj.ar) || null : null,
    en: obj.en != null ? String(obj.en) || null : null,
  };
}

type ColMap = Map<string, number>;

function buildColMap(row: { eachCell: (fn: (cell: { text?: string }, col: number) => void) => void }): ColMap {
  const map = new Map<string, number>();
  row.eachCell((cell, colNumber) => {
    const text = cell.text?.trim();
    if (text) map.set(text, colNumber);
  });
  return map;
}

function isRowBlank(row: { eachCell: (fn: () => void) => void }): boolean {
  let hasValue = false;
  row.eachCell(() => { hasValue = true; });
  return !hasValue;
}

type SheetRow = ReturnType<InstanceType<typeof Workbook>['getWorksheet']> extends infer WS
  ? WS extends object
    ? ReturnType<(WS & { getRow(n: number): unknown })['getRow']>
    : never
  : never;

// Read a translatable text cell — absent column → undefined; present empty → null.
function readTranslatableCell(row: any, colIdx: number | undefined): string | null | undefined {
  if (colIdx === undefined) return undefined;
  const text = (row.getCell(colIdx) as any).text?.trim() ?? '';
  return text || null;
}

// Read a required-scalar string cell — absent column or empty cell → undefined (skip on update).
function readStringCell(row: any, colIdx: number | undefined): string | undefined {
  if (colIdx === undefined) return undefined;
  const text = (row.getCell(colIdx) as any).text?.trim() ?? '';
  return text || undefined;
}

/** Trims and collapses internal whitespace so "Ahmed  Ali" and "Ahmed Ali" compare equal. */
function normalizePersonName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

// Read an integer cell — absent or empty → undefined.
function readIntCell(row: any, colIdx: number | undefined): number | undefined {
  if (colIdx === undefined) return undefined;
  const cell = (row.getCell(colIdx) as any);
  if (cell.type === ValueType.Null || cell.value == null) return undefined;
  if (cell.type === ValueType.Number) {
    const v = typeof cell.value === 'number' ? cell.value : parseFloat(String(cell.value));
    return Number.isFinite(v) ? Math.round(v) : undefined;
  }
  const text = (cell.text as string | undefined)?.trim();
  if (!text) return undefined;
  const n = parseInt(text, 10);
  return Number.isFinite(n) ? n : undefined;
}

// Read a decimal cell — absent or empty → undefined.
function readDecimalCell(row: any, colIdx: number | undefined): number | undefined {
  if (colIdx === undefined) return undefined;
  const cell = (row.getCell(colIdx) as any);
  if (cell.type === ValueType.Null || cell.value == null) return undefined;
  if (cell.type === ValueType.Number) {
    const v = typeof cell.value === 'number' ? cell.value : parseFloat(String(cell.value));
    return Number.isFinite(v) ? v : undefined;
  }
  const text = ((cell.text as string | undefined) ?? '').trim().replace(/,/g, '');
  if (!text) return undefined;
  const n = parseFloat(text);
  return Number.isFinite(n) ? n : undefined;
}

function isCellNumericType(row: any, colIdx: number): boolean {
  return (row.getCell(colIdx) as any).type === ValueType.Number;
}

function makeSheetPlan<T>(sheetName: string): SheetPlan<T> & { _addError: (e: ImportError) => void } {
  const errors: ImportError[] = [];
  let totalErrors = 0;
  return {
    sheetName,
    ops: [] as T[],
    errors,
    warnings: [] as ImportWarning[],
    get errorCount() { return totalErrors; },
    _addError(err: ImportError) {
      totalErrors++;
      if (errors.length < MAX_ERRORS) errors.push(err);
    },
  } as any;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class DataImportService {
  constructor(private readonly prisma: PrismaService) {}

  async parseAndValidate(buffer: Buffer, companyId: string): Promise<ImportPlan> {
    const wb = new Workbook();
    try {
      await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException('الملف المرفوع ليس ملف Excel صالحاً (.xlsx). يرجى رفع ملف بصيغة .xlsx فقط.');
    }

    // First pass: collect customer phones for global collision lookup
    const { allNormalized: scannedCustomerPhones, duplicatePhones } = this.scanCustomerPhones(wb);

    // First pass: collect duplicate _ImportId values in the Leads sheet
    const duplicateLeadImportIds = this.scanLeadImportIds(wb);

    // Bulk-preload all tenant entities in parallel (phase 1 + phase 2)
    const [
      dbProjects, dbPhases, dbBuildings, dbUnits, dbContracts, dbReservations,
      dbClients, globalPhoneHits, dbLeads, dbLeadSources, dbSalesUsers,
    ] = await Promise.all([
      // ── Phase 1 ──
      this.prisma.project.findMany({
        where: { companyId },
        select: { id: true, code: true, name: true, description: true, city: true, status: true, updatedAt: true },
      }),
      this.prisma.phase.findMany({
        where: { companyId },
        select: { id: true, code: true, projectId: true, name: true, order: true },
      }),
      this.prisma.building.findMany({
        where: { companyId },
        select: { id: true, code: true, phaseId: true, name: true, order: true, totalFloors: true },
      }),
      this.prisma.unit.findMany({
        where: { companyId },
        select: { id: true, code: true, buildingId: true, type: true, floor: true, area: true, bedrooms: true, bathrooms: true, price: true, status: true, updatedAt: true },
      }),
      this.prisma.contract.findMany({
        where: { companyId, deletedAt: null },
        select: { unitId: true },
      }),
      this.prisma.reservation.findMany({
        where: {
          companyId,
          status: { notIn: [ReservationStatus.CANCELLED, ReservationStatus.REJECTED, ReservationStatus.EXPIRED] },
        },
        select: { unitId: true },
      }),
      // ── Phase 2 ──
      this.prisma.user.findMany({
        where: { companyId, role: UserRole.CLIENT, deletedAt: null },
        select: { id: true, phone: true, fullName: true, email: true, locale: true, updatedAt: true },
      }),
      scannedCustomerPhones.length > 0
        ? this.prisma.user.findMany({
            // Include both 01XXXXXXXXXX (import canonical) and +201XXXXXXXXXX (E.164,
            // written by the auth service) so the map catches auth-created users.
            // Option B — this company only: the same number at another developer
            // is a separate account and no longer a conflict.
            where: {
              companyId,
              phone: { in: [...scannedCustomerPhones, ...scannedCustomerPhones.map(p => `+20${p.slice(1)}`)] },
            },
            select: { id: true, phone: true, role: true, companyId: true },
          })
        : Promise.resolve<Array<{ id: string; phone: string | null; role: UserRole; companyId: string | null }>>([]),
      this.prisma.lead.findMany({
        where: { companyId },
        select: {
          id: true, phone: true, clientId: true, fullName: true, stage: true,
          sourceId: true, assignedSalesId: true, projectInterestId: true, unitInterestId: true,
          updatedAt: true,
        },
      }),
      this.prisma.leadSource.findMany({
        where: { companyId, active: true },
        select: { id: true, name: true },
      }),
      this.prisma.user.findMany({
        where: {
          companyId,
          role: { in: [UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER] },
          deletedAt: null,
          active: true,
        },
        select: { id: true, fullName: true },
      }),
    ]);

    // ── Phase 1 maps ─────────────────────────────────────────────────────────

    const projectByCode = new Map<string, DbProject>();
    const projectCodeById = new Map<string, string>();
    for (const p of dbProjects) {
      if (!p.code) continue;
      const name = trJson(p.name);
      const desc = trJson(p.description);
      projectByCode.set(p.code, {
        id: p.id, code: p.code, city: p.city, status: p.status, updatedAt: p.updatedAt,
        nameAr: name.ar, nameEn: name.en, descAr: desc.ar, descEn: desc.en,
      });
      projectCodeById.set(p.id, p.code);
    }

    const phaseByKey = new Map<string, DbPhase>();
    const phaseCodeById = new Map<string, { projectCode: string; code: string }>();
    for (const ph of dbPhases) {
      if (!ph.code) continue;
      const projCode = projectCodeById.get(ph.projectId);
      if (!projCode) continue;
      const name = trJson(ph.name);
      const phase: DbPhase = {
        id: ph.id, code: ph.code, projectId: ph.projectId, order: ph.order,
        nameAr: name.ar, nameEn: name.en,
      };
      phaseByKey.set(`${projCode}:${ph.code}`, phase);
      phaseCodeById.set(ph.id, { projectCode: projCode, code: ph.code });
    }

    const buildingByKey = new Map<string, DbBuilding>();
    const buildingCodeById = new Map<string, { projectCode: string; phaseCode: string; code: string }>();
    for (const b of dbBuildings) {
      if (!b.code) continue;
      const phaseInfo = phaseCodeById.get(b.phaseId);
      if (!phaseInfo) continue;
      const building: DbBuilding = {
        id: b.id, code: b.code, phaseId: b.phaseId, name: b.name, order: b.order, totalFloors: b.totalFloors,
      };
      buildingByKey.set(`${phaseInfo.projectCode}:${phaseInfo.code}:${b.code}`, building);
      buildingCodeById.set(b.id, { projectCode: phaseInfo.projectCode, phaseCode: phaseInfo.code, code: b.code });
    }

    const unitByKey = new Map<string, DbUnit>();
    // Also index by bare code for lead unit-interest resolution
    const unitByCode = new Map<string, string[]>(); // code → Unit.id[] (for ambiguity detection)
    for (const u of dbUnits) {
      const bldInfo = buildingCodeById.get(u.buildingId);
      if (!bldInfo) continue;
      const dbUnit: DbUnit = {
        id: u.id, code: u.code, buildingId: u.buildingId, type: u.type,
        floor: u.floor, area: u.area, bedrooms: u.bedrooms, bathrooms: u.bathrooms,
        price: parseFloat(String(u.price)), status: u.status, updatedAt: u.updatedAt,
      };
      unitByKey.set(`${bldInfo.projectCode}:${bldInfo.phaseCode}:${bldInfo.code}:${u.code}`, dbUnit);
      const existing = unitByCode.get(u.code);
      if (existing) existing.push(u.id);
      else unitByCode.set(u.code, [u.id]);
    }

    const activeUnitIds = new Set<string>();
    for (const c of dbContracts) activeUnitIds.add(c.unitId);
    for (const r of dbReservations) activeUnitIds.add(r.unitId);

    // ── Phase 2 maps ─────────────────────────────────────────────────────────

    // Clients by phone (company CLIENTs only).
    // Key is always the 01XXXXXXXXXX importer-canonical form regardless of how the
    // phone is stored (stored may be E.164 +201... for auth-service-created users).
    const clientByPhone = new Map<string, DbClient>();
    for (const u of dbClients) {
      if (!u.phone) continue;
      const key = storedToImportPhone(u.phone) ?? u.phone;
      clientByPhone.set(key, { id: u.id, phone: u.phone, fullName: u.fullName, email: u.email, locale: u.locale, updatedAt: u.updatedAt });
    }

    // Phone map — this company's users of any role holding the scanned phones.
    // Keyed on import-canonical form so globalPhoneMap.get("01...") hits both
    // stored "01..." and stored "+201..." users.
    const globalPhoneMap = new Map<string, { id: string; role: UserRole; companyId: string | null }>();
    for (const u of globalPhoneHits) {
      if (!u.phone) continue;
      const key = storedToImportPhone(u.phone) ?? u.phone;
      globalPhoneMap.set(key, { id: u.id, role: u.role, companyId: u.companyId });
    }

    // Leads by id and by phone (for matching).
    // Phone key is normalised to 01XXXXXXXXXX like the customer maps above.
    const leadById = new Map<string, DbLead>();
    const leadByPhone = new Map<string, DbLead>();
    for (const l of dbLeads) {
      leadById.set(l.id, l as DbLead);
      if (l.phone) {
        const key = storedToImportPhone(l.phone) ?? l.phone;
        leadByPhone.set(key, l as DbLead);
      }
    }

    // Sources by name (AR then EN) — ambiguity set for duplicate names
    const sourceByName = new Map<string, string>(); // name string → source.id
    const ambigSourceName = new Set<string>();
    for (const s of dbLeadSources) {
      const name = trJson(s.name);
      for (const n of [name.ar, name.en]) {
        if (!n) continue;
        if (sourceByName.has(n)) ambigSourceName.add(n);
        else sourceByName.set(n, s.id);
      }
    }

    // Sales reps by fullName (ADMIN, SALES, SALES_MANAGER) — array for ambiguity detection.
    // Keys are whitespace-normalised (trim + collapse) so "Ahmed  Ali" matches "Ahmed Ali".
    const salesByName = new Map<string, string[]>(); // normalised fullName → User.id[]
    for (const u of dbSalesUsers) {
      const normalizedName = normalizePersonName(u.fullName ?? '');
      if (!normalizedName) continue;
      const arr = salesByName.get(normalizedName);
      if (arr) arr.push(u.id);
      else salesByName.set(normalizedName, [u.id]);
    }

    // Projects by name (AR and EN) for lead interest resolution
    const projectByNameAr = new Map<string, string>(); // name.ar → project.id
    const projectByNameEn = new Map<string, string>(); // name.en → project.id
    const ambigProjectAr = new Set<string>();
    const ambigProjectEn = new Set<string>();
    for (const p of dbProjects) {
      const name = trJson(p.name);
      if (name.ar) {
        if (projectByNameAr.has(name.ar)) ambigProjectAr.add(name.ar);
        else projectByNameAr.set(name.ar, p.id);
      }
      if (name.en) {
        if (projectByNameEn.has(name.en)) ambigProjectEn.add(name.en);
        else projectByNameEn.set(name.en, p.id);
      }
    }

    // ── Parse sheets ─────────────────────────────────────────────────────────

    const projects = this.parseProjectsSheet(wb, projectByCode);
    const phases = this.parsePhasesSheet(wb, projectByCode, phaseByKey, projects);
    const buildings = this.parseBuildingsSheet(wb, projectByCode, phaseByKey, buildingByKey, projects, phases);
    const units = this.parseUnitsSheet(wb, phaseByKey, buildingByKey, unitByKey, activeUnitIds, projects, phases, buildings);

    const unresolvedSalesTracker = { count: 0 };
    const customers = this.parseCustomersSheet(
      wb, companyId, clientByPhone, globalPhoneMap, duplicatePhones,
    );
    const leads = this.parseLeadsSheet(
      wb, companyId, leadById, leadByPhone,
      clientByPhone, customers,
      salesByName, sourceByName, ambigSourceName,
      projectByNameAr, projectByNameEn, ambigProjectAr, ambigProjectEn,
      unitByCode, duplicateLeadImportIds,
      unresolvedSalesTracker,
    );

    return {
      companyId,
      projects,
      phases,
      buildings,
      units,
      customers,
      leads,
      unresolvedLeadSalesReps: unresolvedSalesTracker.count,
      hasErrors:
        projects.errorCount > 0 || phases.errorCount > 0 ||
        buildings.errorCount > 0 || units.errorCount > 0 ||
        customers.errorCount > 0 || leads.errorCount > 0,
    };
  }

  // ── First-pass scanners ───────────────────────────────────────────────────────

  private scanCustomerPhones(wb: Workbook): { allNormalized: string[]; duplicatePhones: Set<string> } {
    const ws = wb.getWorksheet(CUSTOMERS_SHEET.name);
    if (!ws) return { allNormalized: [], duplicatePhones: new Set() };

    const colMap = buildColMap(ws.getRow(1));
    const phoneColIdx = colMap.get(CUSTOMERS_SHEET.fields.phone);
    if (phoneColIdx === undefined) return { allNormalized: [], duplicatePhones: new Set() };

    const phoneCounts = new Map<string, number>();
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1 || isRowBlank(row)) return;
      const cell = (row.getCell(phoneColIdx) as any);
      if (cell.type === ValueType.Number) return;
      const raw = ((cell.text as string | undefined) ?? '').trim();
      const result = normalizePhone(raw);
      if (!result.error) {
        phoneCounts.set(result.normalized, (phoneCounts.get(result.normalized) ?? 0) + 1);
      }
    });

    const allNormalized: string[] = [];
    const duplicatePhones = new Set<string>();
    for (const [phone, count] of phoneCounts) {
      allNormalized.push(phone);
      if (count >= 2) duplicatePhones.add(phone);
    }
    return { allNormalized, duplicatePhones };
  }

  private scanLeadImportIds(wb: Workbook): Set<string> {
    const ws = wb.getWorksheet(LEADS_SHEET.name);
    if (!ws) return new Set();

    const colMap = buildColMap(ws.getRow(1));
    const importIdColIdx = colMap.get(LEADS_SHEET.fields.importId);
    if (importIdColIdx === undefined) return new Set();

    const counts = new Map<string, number>();
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1 || isRowBlank(row)) return;
      const cell = (row.getCell(importIdColIdx) as any);
      const raw = ((cell.text as string | undefined) ?? '').trim().toLowerCase();
      if (raw) counts.set(raw, (counts.get(raw) ?? 0) + 1);
    });

    const duplicates = new Set<string>();
    for (const [id, count] of counts) {
      if (count >= 2) duplicates.add(id);
    }
    return duplicates;
  }

  // ── Projects ─────────────────────────────────────────────────────────────────

  private parseProjectsSheet(
    wb: Workbook,
    projectByCode: Map<string, DbProject>,
  ): SheetPlan<ProjectPlan> {
    const plan = makeSheetPlan<ProjectPlan>(PROJECTS_SHEET.name);
    const ws = wb.getWorksheet(PROJECTS_SHEET.name);
    if (!ws) return plan;

    const colMap = buildColMap(ws.getRow(1));
    const codeColIdx = colMap.get(PROJECTS_SHEET.fields.code);
    if (!codeColIdx) {
      plan._addError({ sheet: PROJECTS_SHEET.name, rowNumber: 0, column: PROJECTS_SHEET.fields.code, message: `Required column missing: "${PROJECTS_SHEET.fields.code}"` });
      return plan;
    }

    const nameArColIdx  = colMap.get(PROJECTS_SHEET.fields.nameAr);
    const nameEnColIdx  = colMap.get(PROJECTS_SHEET.fields.nameEn);
    const descArColIdx  = colMap.get(PROJECTS_SHEET.fields.descAr);
    const descEnColIdx  = colMap.get(PROJECTS_SHEET.fields.descEn);
    const cityColIdx    = colMap.get(PROJECTS_SHEET.fields.city);
    const statusColIdx  = colMap.get(PROJECTS_SHEET.fields.status);

    const seenCodes = new Set<string>();
    let dataRows = 0;

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      if (isRowBlank(row)) return;

      dataRows++;
      // provisional guard, NOT measured
      if (dataRows > MAX_ROWS) {
        if (dataRows === MAX_ROWS + 1) {
          plan._addError({ sheet: PROJECTS_SHEET.name, rowNumber, message: `Sheet exceeds ${MAX_ROWS}-row limit (provisional guard, NOT measured)` });
        }
        return;
      }

      if (isCellNumericType(row, codeColIdx)) {
        plan._addError({ sheet: PROJECTS_SHEET.name, rowNumber, column: PROJECTS_SHEET.fields.code, message: 'Code cell is stored as a Number. Format the column as Text in Excel before importing.' });
        return;
      }
      const rawCode = readStringCell(row, codeColIdx);
      if (!rawCode) {
        plan._addError({ sheet: PROJECTS_SHEET.name, rowNumber, column: PROJECTS_SHEET.fields.code, message: 'Code is required' });
        return;
      }
      const code = rawCode.toUpperCase();
      if (!ENTITY_CODE_PATTERN.test(code)) {
        plan._addError({ sheet: PROJECTS_SHEET.name, rowNumber, column: PROJECTS_SHEET.fields.code, message: `Invalid code "${code}": 2–64 chars, uppercase letters, digits, hyphens only (e.g. NILE-CREST)` });
        return;
      }
      if (seenCodes.has(code)) {
        plan._addError({ sheet: PROJECTS_SHEET.name, rowNumber, column: PROJECTS_SHEET.fields.code, message: `Duplicate code "${code}" within this sheet — both rows are rejected` });
        return;
      }
      seenCodes.add(code);

      const nameAr = readTranslatableCell(row, nameArColIdx);
      const nameEn = readTranslatableCell(row, nameEnColIdx);
      const descAr = readTranslatableCell(row, descArColIdx);
      const descEn = readTranslatableCell(row, descEnColIdx);
      const city   = readStringCell(row, cityColIdx);

      let status: ProjectStatus | undefined;
      if (statusColIdx !== undefined) {
        const rawStatus = readStringCell(row, statusColIdx);
        if (rawStatus) {
          const up = rawStatus.toUpperCase() as ProjectStatus;
          if (!Object.values(ProjectStatus).includes(up)) {
            plan._addError({ sheet: PROJECTS_SHEET.name, rowNumber, column: PROJECTS_SHEET.fields.status, message: `Invalid status "${rawStatus}". Must be one of: ${Object.values(ProjectStatus).join(', ')}` });
            return;
          }
          status = up;
        }
      }

      const existing = projectByCode.get(code);
      let op: ImportOp;
      let id: string | undefined;

      if (!existing) {
        if (!city) {
          plan._addError({ sheet: PROJECTS_SHEET.name, rowNumber, column: PROJECTS_SHEET.fields.city, message: 'City is required when creating a new project' });
          return;
        }
        op = 'create';
      } else {
        id = existing.id;
        const changed =
          (nameAr !== undefined && nameAr !== existing.nameAr) ||
          (nameEn !== undefined && nameEn !== existing.nameEn) ||
          (descAr !== undefined && descAr !== existing.descAr) ||
          (descEn !== undefined && descEn !== existing.descEn) ||
          (city !== undefined   && city   !== existing.city)   ||
          (status !== undefined && status !== existing.status);
        op = changed ? 'update' : 'unchanged';
      }

      if (existing && op === 'update' && status !== undefined && existing.status === ProjectStatus.PUBLISHED && status !== ProjectStatus.PUBLISHED) {
        plan.warnings.push({
          sheet: PROJECTS_SHEET.name,
          rowNumber,
          column: PROJECTS_SHEET.fields.status,
          message: `Project "${code}" is currently PUBLISHED. Changing its status to "${status}" will hide it from the public website immediately.`,
        });
      }

      plan.ops.push({ rowNumber, op, code, id, nameAr, nameEn, descAr, descEn, city, status });
    });

    return plan;
  }

  // ── Phases ───────────────────────────────────────────────────────────────────

  private parsePhasesSheet(
    wb: Workbook,
    projectByCode: Map<string, DbProject>,
    phaseByKey: Map<string, DbPhase>,
    projectsPlan: SheetPlan<ProjectPlan>,
  ): SheetPlan<PhasePlan> {
    const plan = makeSheetPlan<PhasePlan>(PHASES_SHEET.name);
    const ws = wb.getWorksheet(PHASES_SHEET.name);
    if (!ws) return plan;

    const colMap = buildColMap(ws.getRow(1));
    const projCodeColIdx  = colMap.get(PHASES_SHEET.fields.projectCode);
    const codeColIdx      = colMap.get(PHASES_SHEET.fields.code);

    if (!projCodeColIdx || !codeColIdx) {
      const missing = [
        !projCodeColIdx ? `"${PHASES_SHEET.fields.projectCode}"` : null,
        !codeColIdx     ? `"${PHASES_SHEET.fields.code}"` : null,
      ].filter(Boolean).join(', ');
      plan._addError({ sheet: PHASES_SHEET.name, rowNumber: 0, message: `Required column(s) missing: ${missing}` });
      return plan;
    }

    const nameArColIdx = colMap.get(PHASES_SHEET.fields.nameAr);
    const nameEnColIdx = colMap.get(PHASES_SHEET.fields.nameEn);
    const orderColIdx  = colMap.get(PHASES_SHEET.fields.order);

    const allProjectCodes = new Set([
      ...projectByCode.keys(),
      ...projectsPlan.ops.map((p) => p.code),
    ]);

    const seenKeys = new Set<string>();
    let dataRows = 0;

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      if (isRowBlank(row)) return;

      dataRows++;
      if (dataRows > MAX_ROWS) {
        if (dataRows === MAX_ROWS + 1) {
          plan._addError({ sheet: PHASES_SHEET.name, rowNumber, message: `Sheet exceeds ${MAX_ROWS}-row limit (provisional guard, NOT measured)` });
        }
        return;
      }

      const projectCode = readStringCell(row, projCodeColIdx)?.toUpperCase();
      if (!projectCode) {
        plan._addError({ sheet: PHASES_SHEET.name, rowNumber, column: PHASES_SHEET.fields.projectCode, message: 'Project code is required' });
        return;
      }
      if (!allProjectCodes.has(projectCode)) {
        plan._addError({ sheet: PHASES_SHEET.name, rowNumber, column: PHASES_SHEET.fields.projectCode, message: `Unknown project code "${projectCode}" — create the project first or include it in the Projects sheet` });
        return;
      }

      if (isCellNumericType(row, codeColIdx)) {
        plan._addError({ sheet: PHASES_SHEET.name, rowNumber, column: PHASES_SHEET.fields.code, message: 'Phase code cell is stored as a Number. Format as Text before importing.' });
        return;
      }
      const rawCode = readStringCell(row, codeColIdx);
      if (!rawCode) {
        plan._addError({ sheet: PHASES_SHEET.name, rowNumber, column: PHASES_SHEET.fields.code, message: 'Phase code is required' });
        return;
      }
      const code = rawCode.toUpperCase();
      if (!ENTITY_CODE_PATTERN.test(code)) {
        plan._addError({ sheet: PHASES_SHEET.name, rowNumber, column: PHASES_SHEET.fields.code, message: `Invalid phase code "${code}": 2–64 chars, uppercase letters, digits, hyphens only` });
        return;
      }
      const seenKey = `${projectCode}:${code}`;
      if (seenKeys.has(seenKey)) {
        plan._addError({ sheet: PHASES_SHEET.name, rowNumber, column: PHASES_SHEET.fields.code, message: `Duplicate phase code "${code}" within project "${projectCode}" in this sheet` });
        return;
      }
      seenKeys.add(seenKey);

      const nameAr = readTranslatableCell(row, nameArColIdx);
      const nameEn = readTranslatableCell(row, nameEnColIdx);
      const order  = readIntCell(row, orderColIdx);

      const projectId = projectByCode.get(projectCode)?.id;

      let op: ImportOp;
      let id: string | undefined;

      const existing = projectId ? phaseByKey.get(`${projectCode}:${code}`) : undefined;
      if (!existing) {
        op = 'create';
      } else {
        id = existing.id;
        const changed =
          (nameAr !== undefined && nameAr !== existing.nameAr) ||
          (nameEn !== undefined && nameEn !== existing.nameEn) ||
          (order  !== undefined && order  !== existing.order);
        op = changed ? 'update' : 'unchanged';
      }

      plan.ops.push({ rowNumber, op, code, projectCode, id, projectId, nameAr, nameEn, order });
    });

    return plan;
  }

  // ── Buildings ─────────────────────────────────────────────────────────────────

  private parseBuildingsSheet(
    wb: Workbook,
    projectByCode: Map<string, DbProject>,
    phaseByKey: Map<string, DbPhase>,
    buildingByKey: Map<string, DbBuilding>,
    projectsPlan: SheetPlan<ProjectPlan>,
    phasesPlan: SheetPlan<PhasePlan>,
  ): SheetPlan<BuildingPlan> {
    const plan = makeSheetPlan<BuildingPlan>(BUILDINGS_SHEET.name);
    const ws = wb.getWorksheet(BUILDINGS_SHEET.name);
    if (!ws) return plan;

    const colMap = buildColMap(ws.getRow(1));
    const projCodeColIdx  = colMap.get(BUILDINGS_SHEET.fields.projectCode);
    const phaseCodeColIdx = colMap.get(BUILDINGS_SHEET.fields.phaseCode);
    const codeColIdx      = colMap.get(BUILDINGS_SHEET.fields.code);

    if (!projCodeColIdx || !phaseCodeColIdx || !codeColIdx) {
      const missing = [
        !projCodeColIdx  ? `"${BUILDINGS_SHEET.fields.projectCode}"` : null,
        !phaseCodeColIdx ? `"${BUILDINGS_SHEET.fields.phaseCode}"` : null,
        !codeColIdx      ? `"${BUILDINGS_SHEET.fields.code}"` : null,
      ].filter(Boolean).join(', ');
      plan._addError({ sheet: BUILDINGS_SHEET.name, rowNumber: 0, message: `Required column(s) missing: ${missing}` });
      return plan;
    }

    const nameColIdx        = colMap.get(BUILDINGS_SHEET.fields.name);
    const orderColIdx       = colMap.get(BUILDINGS_SHEET.fields.order);
    const totalFloorsColIdx = colMap.get(BUILDINGS_SHEET.fields.totalFloors);

    const allPhaseKeys = new Set<string>();
    for (const [key] of phaseByKey) allPhaseKeys.add(key);
    for (const p of phasesPlan.ops) allPhaseKeys.add(`${p.projectCode}:${p.code}`);

    const seenKeys = new Set<string>();
    let dataRows = 0;

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      if (isRowBlank(row)) return;

      dataRows++;
      if (dataRows > MAX_ROWS) {
        if (dataRows === MAX_ROWS + 1) {
          plan._addError({ sheet: BUILDINGS_SHEET.name, rowNumber, message: `Sheet exceeds ${MAX_ROWS}-row limit (provisional guard, NOT measured)` });
        }
        return;
      }

      const projectCode = readStringCell(row, projCodeColIdx)?.toUpperCase();
      const phaseCode   = readStringCell(row, phaseCodeColIdx)?.toUpperCase();

      if (!projectCode) {
        plan._addError({ sheet: BUILDINGS_SHEET.name, rowNumber, column: BUILDINGS_SHEET.fields.projectCode, message: 'Project code is required' });
        return;
      }
      if (!phaseCode) {
        plan._addError({ sheet: BUILDINGS_SHEET.name, rowNumber, column: BUILDINGS_SHEET.fields.phaseCode, message: 'Phase code is required' });
        return;
      }
      if (!allPhaseKeys.has(`${projectCode}:${phaseCode}`)) {
        plan._addError({ sheet: BUILDINGS_SHEET.name, rowNumber, column: BUILDINGS_SHEET.fields.phaseCode, message: `Unknown phase "${phaseCode}" in project "${projectCode}" — include the phase in the Phases sheet or ensure it exists in the database` });
        return;
      }

      if (isCellNumericType(row, codeColIdx)) {
        plan._addError({ sheet: BUILDINGS_SHEET.name, rowNumber, column: BUILDINGS_SHEET.fields.code, message: 'Building code cell is stored as a Number. Format as Text before importing.' });
        return;
      }
      const rawCode = readStringCell(row, codeColIdx);
      if (!rawCode) {
        plan._addError({ sheet: BUILDINGS_SHEET.name, rowNumber, column: BUILDINGS_SHEET.fields.code, message: 'Building code is required' });
        return;
      }
      const code = rawCode.toUpperCase();
      if (!ENTITY_CODE_PATTERN.test(code)) {
        plan._addError({ sheet: BUILDINGS_SHEET.name, rowNumber, column: BUILDINGS_SHEET.fields.code, message: `Invalid building code "${code}": 2–64 chars, uppercase letters, digits, hyphens only` });
        return;
      }
      const seenKey = `${projectCode}:${phaseCode}:${code}`;
      if (seenKeys.has(seenKey)) {
        plan._addError({ sheet: BUILDINGS_SHEET.name, rowNumber, column: BUILDINGS_SHEET.fields.code, message: `Duplicate building code "${code}" within phase "${phaseCode}" in this sheet` });
        return;
      }
      seenKeys.add(seenKey);

      const name        = readStringCell(row, nameColIdx);
      const order       = readIntCell(row, orderColIdx);
      const totalFloors = readIntCell(row, totalFloorsColIdx);

      const phaseId = phaseByKey.get(`${projectCode}:${phaseCode}`)?.id;

      let op: ImportOp;
      let id: string | undefined;

      const existing = phaseId ? buildingByKey.get(`${projectCode}:${phaseCode}:${code}`) : undefined;
      if (!existing) {
        if (!name) {
          plan._addError({ sheet: BUILDINGS_SHEET.name, rowNumber, column: BUILDINGS_SHEET.fields.name, message: 'Building name is required when creating a new building' });
          return;
        }
        op = 'create';
      } else {
        id = existing.id;
        const changed =
          (name        !== undefined && name        !== existing.name)        ||
          (order       !== undefined && order       !== existing.order)       ||
          (totalFloors !== undefined && totalFloors !== existing.totalFloors);
        op = changed ? 'update' : 'unchanged';
      }

      plan.ops.push({ rowNumber, op, code, projectCode, phaseCode, id, phaseId, name, order, totalFloors });
    });

    return plan;
  }

  // ── Units ─────────────────────────────────────────────────────────────────────

  private parseUnitsSheet(
    wb: Workbook,
    phaseByKey: Map<string, DbPhase>,
    buildingByKey: Map<string, DbBuilding>,
    unitByKey: Map<string, DbUnit>,
    activeUnitIds: Set<string>,
    projectsPlan: SheetPlan<ProjectPlan>,
    phasesPlan: SheetPlan<PhasePlan>,
    buildingsPlan: SheetPlan<BuildingPlan>,
  ): SheetPlan<UnitPlan> {
    const plan = makeSheetPlan<UnitPlan>(UNITS_SHEET.name);
    const ws = wb.getWorksheet(UNITS_SHEET.name);
    if (!ws) return plan;

    const colMap = buildColMap(ws.getRow(1));
    const projCodeColIdx  = colMap.get(UNITS_SHEET.fields.projectCode);
    const phaseCodeColIdx = colMap.get(UNITS_SHEET.fields.phaseCode);
    const bldCodeColIdx   = colMap.get(UNITS_SHEET.fields.buildingCode);
    const codeColIdx      = colMap.get(UNITS_SHEET.fields.code);

    if (!projCodeColIdx || !phaseCodeColIdx || !bldCodeColIdx || !codeColIdx) {
      const missing = [
        !projCodeColIdx  ? `"${UNITS_SHEET.fields.projectCode}"` : null,
        !phaseCodeColIdx ? `"${UNITS_SHEET.fields.phaseCode}"` : null,
        !bldCodeColIdx   ? `"${UNITS_SHEET.fields.buildingCode}"` : null,
        !codeColIdx      ? `"${UNITS_SHEET.fields.code}"` : null,
      ].filter(Boolean).join(', ');
      plan._addError({ sheet: UNITS_SHEET.name, rowNumber: 0, message: `Required column(s) missing: ${missing}` });
      return plan;
    }

    const typeColIdx      = colMap.get(UNITS_SHEET.fields.type);
    const floorColIdx     = colMap.get(UNITS_SHEET.fields.floor);
    const areaColIdx      = colMap.get(UNITS_SHEET.fields.area);
    const bedroomsColIdx  = colMap.get(UNITS_SHEET.fields.bedrooms);
    const bathroomsColIdx = colMap.get(UNITS_SHEET.fields.bathrooms);
    const priceColIdx     = colMap.get(UNITS_SHEET.fields.price);
    const statusColIdx    = colMap.get(UNITS_SHEET.fields.status);

    const allBldKeys = new Set<string>();
    for (const [key] of buildingByKey) allBldKeys.add(key);
    for (const b of buildingsPlan.ops) allBldKeys.add(`${b.projectCode}:${b.phaseCode}:${b.code}`);

    const seenKeys = new Set<string>();
    let dataRows = 0;

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      if (isRowBlank(row)) return;

      dataRows++;
      if (dataRows > MAX_ROWS) {
        if (dataRows === MAX_ROWS + 1) {
          plan._addError({ sheet: UNITS_SHEET.name, rowNumber, message: `Sheet exceeds ${MAX_ROWS}-row limit (provisional guard, NOT measured)` });
        }
        return;
      }

      const projectCode  = readStringCell(row, projCodeColIdx)?.toUpperCase();
      const phaseCode    = readStringCell(row, phaseCodeColIdx)?.toUpperCase();
      const buildingCode = readStringCell(row, bldCodeColIdx)?.toUpperCase();

      if (!projectCode || !phaseCode || !buildingCode) {
        plan._addError({ sheet: UNITS_SHEET.name, rowNumber, message: 'Project, phase, and building codes are all required' });
        return;
      }
      const bldKey = `${projectCode}:${phaseCode}:${buildingCode}`;
      if (!allBldKeys.has(bldKey)) {
        plan._addError({ sheet: UNITS_SHEET.name, rowNumber, column: UNITS_SHEET.fields.buildingCode, message: `Unknown building "${buildingCode}" in phase "${phaseCode}" / project "${projectCode}"` });
        return;
      }

      if (isCellNumericType(row, codeColIdx)) {
        plan._addError({ sheet: UNITS_SHEET.name, rowNumber, column: UNITS_SHEET.fields.code, message: 'Unit code cell is stored as a Number. Format as Text before importing.' });
        return;
      }
      const rawCode = readStringCell(row, codeColIdx);
      if (!rawCode) {
        plan._addError({ sheet: UNITS_SHEET.name, rowNumber, column: UNITS_SHEET.fields.code, message: 'Unit code is required' });
        return;
      }
      const code = rawCode.toUpperCase();
      if (!ENTITY_CODE_PATTERN.test(code)) {
        plan._addError({ sheet: UNITS_SHEET.name, rowNumber, column: UNITS_SHEET.fields.code, message: `Invalid unit code "${code}": 2–64 chars, uppercase letters, digits, hyphens only` });
        return;
      }
      const unitKey = `${bldKey}:${code}`;
      if (seenKeys.has(unitKey)) {
        plan._addError({ sheet: UNITS_SHEET.name, rowNumber, column: UNITS_SHEET.fields.code, message: `Duplicate unit code "${code}" within building "${buildingCode}" in this sheet` });
        return;
      }
      seenKeys.add(unitKey);

      const type      = readStringCell(row, typeColIdx);
      const floor     = readIntCell(row, floorColIdx);
      const area      = readDecimalCell(row, areaColIdx);
      const bedrooms  = readIntCell(row, bedroomsColIdx);
      const bathrooms = readIntCell(row, bathroomsColIdx);
      const price     = readDecimalCell(row, priceColIdx);

      let status: UnitStatus | undefined;
      if (statusColIdx !== undefined) {
        const rawStatus = readStringCell(row, statusColIdx);
        if (rawStatus) {
          const up = rawStatus.toUpperCase() as UnitStatus;
          if (!Object.values(UnitStatus).includes(up)) {
            plan._addError({ sheet: UNITS_SHEET.name, rowNumber, column: UNITS_SHEET.fields.status, message: `Invalid status "${rawStatus}". Must be one of: ${Object.values(UnitStatus).join(', ')}` });
            return;
          }
          status = up;
        }
      }

      const buildingId = buildingByKey.get(bldKey)?.id;

      let op: ImportOp;
      let id: string | undefined;

      const existing = buildingId ? unitByKey.get(unitKey) : undefined;
      if (!existing) {
        if (!type) {
          plan._addError({ sheet: UNITS_SHEET.name, rowNumber, column: UNITS_SHEET.fields.type, message: 'Unit type is required when creating a new unit' });
          return;
        }
        if (area == null) {
          plan._addError({ sheet: UNITS_SHEET.name, rowNumber, column: UNITS_SHEET.fields.area, message: 'Area is required when creating a new unit' });
          return;
        }
        if (price == null) {
          plan._addError({ sheet: UNITS_SHEET.name, rowNumber, column: UNITS_SHEET.fields.price, message: 'Price is required when creating a new unit' });
          return;
        }
        op = 'create';
      } else {
        id = existing.id;

        // Full-row lock: a unit with any active contract or reservation cannot be updated at all.
        // Price, area, type, status — none may change. A stale file value on a contracted unit
        // would silently desync the unit record from its own contract. Lock the whole row.
        if (activeUnitIds.has(existing.id)) {
          plan.warnings.push({
            sheet: UNITS_SHEET.name,
            rowNumber,
            column: UNITS_SHEET.fields.code,
            message: `Unit "${code}" is locked — it has an active contract or reservation. No changes will be applied to this row.`,
          });
          plan.ops.push({ rowNumber, op: 'locked', code, projectCode, phaseCode, buildingCode, id: existing.id, buildingId: existing.buildingId });
          return;
        }

        const changed =
          (type      !== undefined && type      !== existing.type)      ||
          (floor     !== undefined && floor     !== existing.floor)     ||
          (area      !== undefined && area      !== existing.area)      ||
          (bedrooms  !== undefined && bedrooms  !== existing.bedrooms)  ||
          (bathrooms !== undefined && bathrooms !== existing.bathrooms) ||
          (price     !== undefined && Math.abs(price - existing.price) > 0.005) ||
          (status    !== undefined && status    !== existing.status);
        op = changed ? 'update' : 'unchanged';
      }

      plan.ops.push({
        rowNumber, op, code, projectCode, phaseCode, buildingCode,
        id, buildingId, type, floor, area, bedrooms, bathrooms, price, status,
      });
    });

    return plan;
  }

  // ── Customers ─────────────────────────────────────────────────────────────────
  //
  // Identity: (companyId, phone). Phone is normalized to 01XXXXXXXXX canonical form.
  //
  // Updatable: fullName, locale.
  // Create-only: email (could be a future auth credential; overwriting would break login),
  //              role (always CLIENT), companyId, passwordHash, active.
  //
  // Another company's customer is not a collision: User.phone is unique per company
  // (Option B), so the phone lookup is scoped to the importing company and a person
  // known to another developer is imported as a separate account here.
  //
  // Repair escalation: if the phone was repaired (leading 0 added / country code stripped)
  // AND the repaired number matches an existing user, the row is blocked to prevent a
  // silent merge of two customers' data onto one DB row.

  private parseCustomersSheet(
    wb: Workbook,
    companyId: string,
    clientByPhone: Map<string, DbClient>,
    globalPhoneMap: Map<string, { id: string; role: UserRole; companyId: string | null }>,
    duplicatePhones: Set<string>,
  ): SheetPlan<CustomerPlan> {
    const plan = makeSheetPlan<CustomerPlan>(CUSTOMERS_SHEET.name);
    const ws = wb.getWorksheet(CUSTOMERS_SHEET.name);
    if (!ws) return plan;

    const colMap = buildColMap(ws.getRow(1));
    const phoneColIdx = colMap.get(CUSTOMERS_SHEET.fields.phone);
    if (phoneColIdx === undefined) {
      plan._addError({ sheet: CUSTOMERS_SHEET.name, rowNumber: 0, column: CUSTOMERS_SHEET.fields.phone, message: `Required column missing: "${CUSTOMERS_SHEET.fields.phone}"` });
      return plan;
    }

    const fullNameColIdx = colMap.get(CUSTOMERS_SHEET.fields.fullName);
    const emailColIdx    = colMap.get(CUSTOMERS_SHEET.fields.email);
    const localeColIdx   = colMap.get(CUSTOMERS_SHEET.fields.locale);

    // seenPhones tracks which phones have been processed in this pass (for
    // the second-row duplicate rejection — the first row is already rejected
    // via the pre-scanned duplicatePhones set before we reach it here)
    const seenPhones = new Set<string>();
    let dataRows = 0;

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1 || isRowBlank(row)) return;

      dataRows++;
      if (dataRows > MAX_ROWS) {
        if (dataRows === MAX_ROWS + 1) {
          plan._addError({ sheet: CUSTOMERS_SHEET.name, rowNumber, message: `Sheet exceeds ${MAX_ROWS}-row limit (provisional guard, NOT measured)` });
        }
        return;
      }

      // ── Phone (identity) ────────────────────────────────────────────────────

      const phoneCell = (row.getCell(phoneColIdx) as any);
      if (phoneCell.type === ValueType.Number) {
        plan._addError({ sheet: CUSTOMERS_SHEET.name, rowNumber, column: CUSTOMERS_SHEET.fields.phone, message: 'Phone cell is stored as a Number — the leading zero is lost. Format the column as Text in Excel before importing.' });
        return;
      }
      const rawPhone = ((phoneCell.text as string | undefined) ?? '').trim();
      const normResult = normalizePhone(rawPhone);
      if (normResult.error) {
        plan._addError({ sheet: CUSTOMERS_SHEET.name, rowNumber, column: CUSTOMERS_SHEET.fields.phone, message: normResult.error });
        return;
      }
      const phone = normResult.normalized;

      // Duplicate phone — both rows are rejected (pre-scanned duplicatePhones catches the first occurrence)
      if (duplicatePhones.has(phone) || seenPhones.has(phone)) {
        plan._addError({ sheet: CUSTOMERS_SHEET.name, rowNumber, column: CUSTOMERS_SHEET.fields.phone, message: `Duplicate phone "${phone}" within this sheet — all rows sharing this phone are rejected` });
        return;
      }
      seenPhones.add(phone);

      // ── Global phone collision checks ────────────────────────────────────────

      const existingAny = globalPhoneMap.get(phone);

      // Staff account protection: phone belongs to a non-CLIENT user in this company
      if (existingAny && existingAny.companyId === companyId && existingAny.role !== UserRole.CLIENT) {
        plan._addError({
          sheet: CUSTOMERS_SHEET.name,
          rowNumber,
          column: CUSTOMERS_SHEET.fields.phone,
          message: `Phone "${phone}" belongs to a staff account (role: ${existingAny.role}). The importer only creates or updates CLIENT accounts — staff accounts are protected.`,
        });
        return;
      }

      // Repair escalation: a repaired phone that matches an existing user is blocked.
      // A wrong repair produces a valid-looking number that silently merges two customers' data.
      if (normResult.repaired && existingAny) {
        plan._addError({
          sheet: CUSTOMERS_SHEET.name,
          rowNumber,
          column: CUSTOMERS_SHEET.fields.phone,
          message: `Phone "${rawPhone}" was normalised to "${phone}" but that number already exists in the system. Edit the cell to the canonical format (e.g. 01XXXXXXXXX) to confirm this is the correct customer before importing.`,
        });
        return;
      }

      // ── Data fields ──────────────────────────────────────────────────────────

      const fullName = readStringCell(row, fullNameColIdx);
      const email    = readStringCell(row, emailColIdx);
      const rawLocale = readStringCell(row, localeColIdx);

      let locale: Locale | undefined;
      if (rawLocale) {
        const lc = rawLocale.toLowerCase() as Locale;
        if (!(Object.values(Locale) as string[]).includes(lc)) {
          plan._addError({ sheet: CUSTOMERS_SHEET.name, rowNumber, column: CUSTOMERS_SHEET.fields.locale, message: `Invalid locale "${rawLocale}". Must be one of: ${Object.values(Locale).join(', ')}` });
          return;
        }
        locale = lc;
      }

      // ── Op classification ────────────────────────────────────────────────────

      const existing = clientByPhone.get(phone);
      let op: ImportOp;
      let id: string | undefined;

      if (!existing) {
        if (!fullName) {
          plan._addError({ sheet: CUSTOMERS_SHEET.name, rowNumber, column: CUSTOMERS_SHEET.fields.fullName, message: 'Full name is required when creating a new customer' });
          return;
        }
        op = 'create';
      } else {
        id = existing.id;
        const changed =
          (fullName !== undefined && fullName !== existing.fullName) ||
          (locale   !== undefined && locale   !== existing.locale);
        op = changed ? 'update' : 'unchanged';

        // Email is create-only. Emit a visible warning when the file's value differs from
        // what is stored so the admin knows the import will not change it. Silently
        // discarding a mismatched email is worse than a rejection — the admin would
        // believe the correction landed when it did not.
        if (email !== undefined && email !== existing.email) {
          plan.warnings.push({
            sheet: CUSTOMERS_SHEET.name,
            rowNumber,
            column: CUSTOMERS_SHEET.fields.email,
            message: `Email is create-only and cannot be changed via import. File has "${email}", stored value is "${existing.email ?? '(none)'}". The import will not change this field.`,
          });
        }
      }

      // Warn for repaired phone with no existing match — import proceeds but admin should verify
      if (normResult.repaired && !existingAny) {
        plan.warnings.push({
          sheet: CUSTOMERS_SHEET.name,
          rowNumber,
          column: CUSTOMERS_SHEET.fields.phone,
          message: `Phone "${rawPhone}" was normalised to "${phone}" — verify this is the correct number before importing.`,
        });
      }

      plan.ops.push({
        rowNumber, op, phone, id, fullName, locale,
        ...(op === 'create' ? { email: email ?? null } : {}),
      });
    });

    return plan;
  }

  // ── Leads ─────────────────────────────────────────────────────────────────────
  //
  // Identity:
  //   Primary   — _ImportId (Lead.id UUID) when present
  //   Fallback  — (companyId, lead.phone) when _ImportId absent
  //   Neither   — blocking row error (no idempotent identity)
  //
  // Updatable: fullName, stage, sourceId, assignedSalesId, projectInterestId, unitInterestId.
  // Create-only: clientId, phone (denormalized), email (denormalized), companyId.
  //
  // Unresolved references (source, sales rep, project, unit) → WARNING + field set to null.
  // This differs from Phase 1's hard parent rule: a lead without a source is usable;
  // a unit without a building is not.

  private parseLeadsSheet(
    wb: Workbook,
    companyId: string,
    leadById: Map<string, DbLead>,
    leadByPhone: Map<string, DbLead>,
    clientByPhone: Map<string, DbClient>,
    customersPlan: SheetPlan<CustomerPlan>,
    salesByName: Map<string, string[]>,
    sourceByName: Map<string, string>,
    ambigSourceName: Set<string>,
    projectByNameAr: Map<string, string>,
    projectByNameEn: Map<string, string>,
    ambigProjectAr: Set<string>,
    ambigProjectEn: Set<string>,
    unitByCode: Map<string, string[]>,
    duplicateLeadImportIds: Set<string>,
    unresolvedSalesTracker: { count: number },
  ): SheetPlan<LeadPlan> {
    const plan = makeSheetPlan<LeadPlan>(LEADS_SHEET.name);
    const ws = wb.getWorksheet(LEADS_SHEET.name);
    if (!ws) return plan;

    const colMap = buildColMap(ws.getRow(1));
    const importIdColIdx      = colMap.get(LEADS_SHEET.fields.importId);
    const phoneColIdx         = colMap.get(LEADS_SHEET.fields.phone);
    const fullNameColIdx      = colMap.get(LEADS_SHEET.fields.fullName);
    const emailColIdx         = colMap.get(LEADS_SHEET.fields.email);
    const stageColIdx         = colMap.get(LEADS_SHEET.fields.stage);
    const sourceColIdx        = colMap.get(LEADS_SHEET.fields.source);
    const assignedSalesColIdx = colMap.get(LEADS_SHEET.fields.assignedSales);
    const projArColIdx        = colMap.get(LEADS_SHEET.fields.projectInterestAr);
    const projEnColIdx        = colMap.get(LEADS_SHEET.fields.projectInterestEn);
    const unitCodeColIdx      = colMap.get(LEADS_SHEET.fields.unitCode);

    // Build a phone → clientId map from the customers plan so we can resolve
    // clientId for leads whose customer is being created in the same run
    const customersPhoneToClientId = new Map<string, string | undefined>(); // phone → id (undefined = new)
    for (const c of customersPlan.ops) {
      customersPhoneToClientId.set(c.phone, c.id); // c.id is undefined for creates
    }

    const seenLeadPhones = new Set<string>(); // for fallback-identity duplicate detection
    let dataRows = 0;

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1 || isRowBlank(row)) return;

      dataRows++;
      if (dataRows > MAX_ROWS) {
        if (dataRows === MAX_ROWS + 1) {
          plan._addError({ sheet: LEADS_SHEET.name, rowNumber, message: `Sheet exceeds ${MAX_ROWS}-row limit (provisional guard, NOT measured)` });
        }
        return;
      }

      // ── Identity: _ImportId ──────────────────────────────────────────────────

      let importId: string | undefined;
      if (importIdColIdx !== undefined) {
        const cell = (row.getCell(importIdColIdx) as any);
        const rawId = ((cell.text as string | undefined) ?? '').trim().toLowerCase();
        if (rawId) {
          if (!UUID_RE.test(rawId)) {
            plan._addError({ sheet: LEADS_SHEET.name, rowNumber, column: LEADS_SHEET.fields.importId, message: `_ImportId "${rawId}" is not a valid UUID` });
            return;
          }
          if (duplicateLeadImportIds.has(rawId)) {
            plan._addError({ sheet: LEADS_SHEET.name, rowNumber, column: LEADS_SHEET.fields.importId, message: `Duplicate _ImportId "${rawId}" within this sheet — all rows sharing it are rejected` });
            return;
          }
          importId = rawId;
        }
      }

      // ── Identity: phone (fallback) ───────────────────────────────────────────

      let phone: string | undefined;
      if (phoneColIdx !== undefined) {
        const phoneCell = (row.getCell(phoneColIdx) as any);
        if (phoneCell.type === ValueType.Number) {
          if (!importId) {
            plan._addError({ sheet: LEADS_SHEET.name, rowNumber, column: LEADS_SHEET.fields.phone, message: 'Phone cell is stored as a Number — leading zero is lost. Format as Text. No _ImportId to fall back on.' });
            return;
          }
          // _ImportId present: warn and continue without phone
          plan.warnings.push({ sheet: LEADS_SHEET.name, rowNumber, column: LEADS_SHEET.fields.phone, message: 'Phone cell is stored as a Number — cannot be used for customer resolution. _ImportId will be used for identity.' });
        } else {
          const rawPhone = ((phoneCell.text as string | undefined) ?? '').trim();
          if (rawPhone) {
            const nr = normalizePhone(rawPhone);
            if (nr.error) {
              if (!importId) {
                plan._addError({ sheet: LEADS_SHEET.name, rowNumber, column: LEADS_SHEET.fields.phone, message: nr.error });
                return;
              }
              plan.warnings.push({ sheet: LEADS_SHEET.name, rowNumber, column: LEADS_SHEET.fields.phone, message: `${nr.error} (using _ImportId for identity)` });
            } else {
              phone = nr.normalized;
              if (nr.repaired) {
                plan.warnings.push({ sheet: LEADS_SHEET.name, rowNumber, column: LEADS_SHEET.fields.phone, message: `Phone "${rawPhone}" was normalised to "${phone}".` });
              }
            }
          }
        }
      }

      // Neither _ImportId nor phone → cannot import idempotently
      if (!importId && !phone) {
        plan._addError({ sheet: LEADS_SHEET.name, rowNumber, message: 'Row has neither a valid _ImportId nor a valid phone — cannot be imported idempotently.' });
        return;
      }

      // ── Resolve existing lead ────────────────────────────────────────────────

      let existingLead: DbLead | undefined;
      if (importId) {
        existingLead = leadById.get(importId);
        // Non-existent _ImportId → INSERT (not an error per spec)
      } else if (phone) {
        if (seenLeadPhones.has(phone)) {
          plan._addError({ sheet: LEADS_SHEET.name, rowNumber, column: LEADS_SHEET.fields.phone, message: `Duplicate phone "${phone}" used as fallback identity — second occurrence rejected` });
          return;
        }
        seenLeadPhones.add(phone);
        existingLead = leadByPhone.get(phone);
      }

      // ── Data fields ──────────────────────────────────────────────────────────

      const fullName = readStringCell(row, fullNameColIdx);
      const email    = readStringCell(row, emailColIdx);
      const rawStage = readStringCell(row, stageColIdx);
      const sourceName   = readStringCell(row, sourceColIdx);
      const salesName    = readStringCell(row, assignedSalesColIdx);
      const projArName   = readStringCell(row, projArColIdx);
      const projEnName   = readStringCell(row, projEnColIdx);
      const rawUnitCode  = readStringCell(row, unitCodeColIdx);

      // Validate stage
      let stage: LeadStage | undefined;
      if (rawStage) {
        const up = rawStage.toUpperCase() as LeadStage;
        if (!(Object.values(LeadStage) as string[]).includes(up)) {
          plan._addError({ sheet: LEADS_SHEET.name, rowNumber, column: LEADS_SHEET.fields.stage, message: `Invalid stage "${rawStage}". Must be one of: ${Object.values(LeadStage).join(', ')}` });
          return;
        }
        stage = up;
      }

      // Resolve source (AR/EN name → id; ambiguous or not-found → null + warn)
      let sourceId: string | null | undefined = undefined;
      if (sourceColIdx !== undefined) {
        if (sourceName) {
          if (ambigSourceName.has(sourceName)) {
            plan.warnings.push({ sheet: LEADS_SHEET.name, rowNumber, column: LEADS_SHEET.fields.source, message: `Source "${sourceName}" matches multiple records — leaving sourceId unset.` });
            sourceId = undefined; // ambiguous: do not touch the existing field
          } else {
            sourceId = sourceByName.get(sourceName) ?? null;
            if (sourceId === null) {
              plan.warnings.push({ sheet: LEADS_SHEET.name, rowNumber, column: LEADS_SHEET.fields.source, message: `Source "${sourceName}" not found — leaving sourceId unset.` });
              sourceId = undefined; // not-found: do not touch the existing field
            }
          }
        } else {
          sourceId = null; // column present, cell empty → clear
        }
      }

      // Resolve assigned sales rep (fullName → id; 0 or 2+ → null + warn).
      // Both the stored name (built with normalizePersonName) and the cell value are
      // normalised before comparison so extra whitespace does not break matching.
      let assignedSalesId: string | null | undefined = undefined;
      if (assignedSalesColIdx !== undefined) {
        if (salesName) {
          const normalizedSalesName = normalizePersonName(salesName);
          const matches = salesByName.get(normalizedSalesName);
          if (!matches || matches.length === 0) {
            unresolvedSalesTracker.count++;
            plan.warnings.push({ sheet: LEADS_SHEET.name, rowNumber, column: LEADS_SHEET.fields.assignedSales, message: `Sales rep "${salesName}" not found in this company — leaving assignedSalesId unset.` });
            assignedSalesId = undefined; // not-found: do not touch the existing field
          } else if (matches.length > 1) {
            unresolvedSalesTracker.count++;
            plan.warnings.push({ sheet: LEADS_SHEET.name, rowNumber, column: LEADS_SHEET.fields.assignedSales, message: `Sales rep "${salesName}" matches ${matches.length} users — leaving assignedSalesId unset to avoid wrong assignment.` });
            assignedSalesId = undefined; // ambiguous: do not touch the existing field
          } else {
            assignedSalesId = matches[0]!;
          }
        } else {
          assignedSalesId = null; // column present, cell empty → clear
        }
      }

      // Resolve project interest (AR name first, EN fallback; ambiguous or not-found → null + warn)
      let projectInterestId: string | null | undefined = undefined;
      if (projArColIdx !== undefined || projEnColIdx !== undefined) {
        const resolvedId = this.resolveProjectName(
          projArName, projEnName,
          projectByNameAr, projectByNameEn, ambigProjectAr, ambigProjectEn,
        );
        if (resolvedId.ambiguous) {
          plan.warnings.push({ sheet: LEADS_SHEET.name, rowNumber, column: LEADS_SHEET.fields.projectInterestAr, message: `Project "${resolvedId.name}" matches multiple records — leaving projectInterestId unset.` });
          projectInterestId = undefined; // ambiguous: do not touch the existing field
        } else if (resolvedId.notFound) {
          if (projArName || projEnName) {
            plan.warnings.push({ sheet: LEADS_SHEET.name, rowNumber, column: LEADS_SHEET.fields.projectInterestAr, message: `Project "${projArName ?? projEnName}" not found — leaving projectInterestId unset.` });
          }
          projectInterestId = projArName || projEnName ? undefined : undefined;
        } else {
          projectInterestId = resolvedId.id ?? null;
        }
      }

      // Resolve unit interest (code → id; ambiguous or not-found → null + warn)
      let unitInterestId: string | null | undefined = undefined;
      if (unitCodeColIdx !== undefined) {
        if (rawUnitCode) {
          const matches = unitByCode.get(rawUnitCode.toUpperCase());
          if (!matches || matches.length === 0) {
            plan.warnings.push({ sheet: LEADS_SHEET.name, rowNumber, column: LEADS_SHEET.fields.unitCode, message: `Unit "${rawUnitCode}" not found — leaving unitInterestId unset.` });
            unitInterestId = undefined; // not-found: do not touch the existing field
          } else if (matches.length > 1) {
            plan.warnings.push({ sheet: LEADS_SHEET.name, rowNumber, column: LEADS_SHEET.fields.unitCode, message: `Unit code "${rawUnitCode}" is ambiguous (found in ${matches.length} buildings) — leaving unitInterestId unset.` });
            unitInterestId = undefined; // ambiguous: do not touch the existing field
          } else {
            unitInterestId = matches[0]!;
          }
        } else {
          unitInterestId = null; // column present, cell empty → clear
        }
      }

      // ── Op classification ────────────────────────────────────────────────────

      let op: ImportOp;
      let id: string | undefined;
      let clientId: string | undefined;

      if (!existingLead) {
        // ── CREATE: resolve clientId from the customer linked to this phone ────

        if (!phone) {
          // _ImportId present but not in DB, and no phone → can't resolve clientId
          plan._addError({ sheet: LEADS_SHEET.name, rowNumber, column: LEADS_SHEET.fields.phone, message: 'New lead requires a phone to link to a customer. Provide the customer\'s phone number.' });
          return;
        }

        const clientInDB = clientByPhone.get(phone);
        if (clientInDB) {
          clientId = clientInDB.id;
        } else if (customersPhoneToClientId.has(phone)) {
          clientId = customersPhoneToClientId.get(phone); // undefined if customer is new in this run
        } else {
          plan._addError({ sheet: LEADS_SHEET.name, rowNumber, column: LEADS_SHEET.fields.phone, message: `No customer found with phone "${phone}". Include this customer in the Customers sheet or ensure they already exist.` });
          return;
        }

        if (!fullName) {
          plan._addError({ sheet: LEADS_SHEET.name, rowNumber, column: LEADS_SHEET.fields.fullName, message: 'Full name is required when creating a new lead' });
          return;
        }

        op = 'create';
      } else {
        // ── UPDATE / UNCHANGED ────────────────────────────────────────────────

        id = existingLead.id;

        const changed =
          (fullName          !== undefined && fullName          !== existingLead.fullName) ||
          (stage             !== undefined && stage             !== existingLead.stage) ||
          (sourceId          !== undefined && sourceId          !== existingLead.sourceId) ||
          (assignedSalesId   !== undefined && assignedSalesId   !== existingLead.assignedSalesId) ||
          (projectInterestId !== undefined && projectInterestId !== existingLead.projectInterestId) ||
          (unitInterestId    !== undefined && unitInterestId    !== existingLead.unitInterestId);

        op = changed ? 'update' : 'unchanged';
      }

      plan.ops.push({
        rowNumber, op, importId, id, phone, clientId,
        fullName, stage, sourceId, assignedSalesId, projectInterestId, unitInterestId,
        ...(op === 'create' ? { email: email ?? null } : {}),
      });
    });

    return plan;
  }

  private resolveProjectName(
    nameAr: string | undefined,
    nameEn: string | undefined,
    byAr: Map<string, string>,
    byEn: Map<string, string>,
    ambigAr: Set<string>,
    ambigEn: Set<string>,
  ): { id?: string; ambiguous: boolean; notFound: boolean; name?: string } {
    if (nameAr) {
      if (ambigAr.has(nameAr)) return { ambiguous: true, notFound: false, name: nameAr };
      const id = byAr.get(nameAr);
      if (id) return { id, ambiguous: false, notFound: false };
    }
    if (nameEn) {
      if (ambigEn.has(nameEn)) return { ambiguous: true, notFound: false, name: nameEn };
      const id = byEn.get(nameEn);
      if (id) return { id, ambiguous: false, notFound: false };
    }
    return { ambiguous: false, notFound: true };
  }

  // ── Apply ─────────────────────────────────────────────────────────────────────

  async applyPlan(plan: ImportPlan, actorId: string): Promise<ImportResult> {
    const resolvedProjectIds  = new Map<string, string>();
    const resolvedPhaseIds    = new Map<string, string>();
    const resolvedBuildingIds = new Map<string, string>();

    // ── Projects ──────────────────────────────────────────────────────────────

    const projectResult = await this.prisma.$transaction(async (tx) => {
      let created = 0, updated = 0, unchanged = 0;

      for (const p of plan.projects.ops) {
        if (p.op === 'unchanged') {
          unchanged++;
          if (p.id) resolvedProjectIds.set(p.code, p.id);
          continue;
        }

        const updateData: Prisma.ProjectUpdateInput = {};
        if (p.nameAr !== undefined || p.nameEn !== undefined) {
          updateData.name = { ar: p.nameAr ?? null, en: p.nameEn ?? null } as object;
        }
        if (p.descAr !== undefined || p.descEn !== undefined) {
          updateData.description = { ar: p.descAr ?? null, en: p.descEn ?? null } as object;
        }
        if (p.city !== undefined) updateData.city = p.city;
        if (p.status !== undefined) updateData.status = p.status;

        const row = await (tx.project as any).upsert({
          where: { companyId_code: { companyId: plan.companyId, code: p.code } },
          create: {
            companyId: plan.companyId,
            code: p.code,
            name: { ar: p.nameAr ?? '', en: p.nameEn ?? '' },
            description: { ar: p.descAr ?? '', en: p.descEn ?? '' },
            city: p.city!,
            status: p.status ?? ProjectStatus.DRAFT,
            lat: 0,
            lng: 0,
          },
          update: updateData,
          select: { id: true },
        });
        resolvedProjectIds.set(p.code, row.id);
        if (p.op === 'create') created++; else updated++;
      }

      return { sheetName: PROJECTS_SHEET.name, created, updated, unchanged, locked: 0, warnings: [...plan.projects.warnings] };
    });

    // ── Phases ────────────────────────────────────────────────────────────────

    const phaseResult = await this.prisma.$transaction(async (tx) => {
      let created = 0, updated = 0, unchanged = 0;

      for (const p of plan.phases.ops) {
        const projectId = p.projectId ?? resolvedProjectIds.get(p.projectCode);
        if (!projectId) continue;

        if (p.op === 'unchanged') {
          unchanged++;
          if (p.id) resolvedPhaseIds.set(`${p.projectCode}:${p.code}`, p.id);
          continue;
        }

        const updateData: Prisma.PhaseUpdateInput = {};
        if (p.nameAr !== undefined || p.nameEn !== undefined) {
          updateData.name = { ar: p.nameAr ?? null, en: p.nameEn ?? null } as object;
        }
        if (p.order !== undefined) updateData.order = p.order;

        const row = await (tx.phase as any).upsert({
          where: { projectId_code: { projectId, code: p.code } },
          create: {
            companyId: plan.companyId,
            projectId,
            code: p.code,
            name: { ar: p.nameAr ?? '', en: p.nameEn ?? '' },
            order: p.order ?? 0,
          },
          update: updateData,
          select: { id: true },
        });
        resolvedPhaseIds.set(`${p.projectCode}:${p.code}`, row.id);
        if (p.op === 'create') created++; else updated++;
      }

      return { sheetName: PHASES_SHEET.name, created, updated, unchanged, locked: 0, warnings: [...plan.phases.warnings] };
    });

    // ── Buildings ─────────────────────────────────────────────────────────────

    const buildingResult = await this.prisma.$transaction(async (tx) => {
      let created = 0, updated = 0, unchanged = 0;

      for (const b of plan.buildings.ops) {
        const phaseId = b.phaseId ?? resolvedPhaseIds.get(`${b.projectCode}:${b.phaseCode}`);
        if (!phaseId) continue;

        if (b.op === 'unchanged') {
          unchanged++;
          if (b.id) resolvedBuildingIds.set(`${b.projectCode}:${b.phaseCode}:${b.code}`, b.id);
          continue;
        }

        const updateData: Prisma.BuildingUpdateInput = {};
        if (b.name        !== undefined) updateData.name = b.name;
        if (b.order       !== undefined) updateData.order = b.order;
        if (b.totalFloors !== undefined) updateData.totalFloors = b.totalFloors;

        const row = await (tx.building as any).upsert({
          where: { phaseId_code: { phaseId, code: b.code } },
          create: {
            companyId: plan.companyId,
            phaseId,
            code: b.code,
            name: b.name!,
            order: b.order ?? 0,
            totalFloors: b.totalFloors ?? 1,
          },
          update: updateData,
          select: { id: true },
        });
        resolvedBuildingIds.set(`${b.projectCode}:${b.phaseCode}:${b.code}`, row.id);
        if (b.op === 'create') created++; else updated++;
      }

      return { sheetName: BUILDINGS_SHEET.name, created, updated, unchanged, locked: 0, warnings: [...plan.buildings.warnings] };
    });

    // ── Units ─────────────────────────────────────────────────────────────────

    const unitResult = await this.prisma.$transaction(async (tx) => {
      let created = 0, updated = 0, unchanged = 0, locked = 0;

      for (const u of plan.units.ops) {
        if (u.op === 'unchanged') { unchanged++; continue; }
        if (u.op === 'locked')    { locked++;    continue; }

        const buildingId = u.buildingId ?? resolvedBuildingIds.get(`${u.projectCode}:${u.phaseCode}:${u.buildingCode}`);
        if (!buildingId) continue;

        const updateData: Prisma.UnitUpdateInput = {};
        if (u.type      !== undefined) updateData.type = u.type;
        if (u.floor     !== undefined) updateData.floor = u.floor;
        if (u.area      !== undefined) updateData.area = u.area;
        if (u.bedrooms  !== undefined) updateData.bedrooms = u.bedrooms;
        if (u.bathrooms !== undefined) updateData.bathrooms = u.bathrooms;
        if (u.price     !== undefined) updateData.price = u.price;
        if (u.status    !== undefined) updateData.status = u.status;

        await (tx.unit as any).upsert({
          where: { buildingId_code: { buildingId, code: u.code } },
          create: {
            companyId: plan.companyId,
            buildingId,
            code: u.code,
            type: u.type!,
            floor: u.floor ?? 0,
            area: u.area!,
            bedrooms: u.bedrooms ?? 0,
            bathrooms: u.bathrooms ?? 0,
            price: u.price!,
            status: u.status ?? UnitStatus.AVAILABLE,
          },
          update: updateData,
        });
        if (u.op === 'create') created++; else updated++;
      }

      return { sheetName: UNITS_SHEET.name, created, updated, unchanged, locked, warnings: [...plan.units.warnings] };
    });

    // ── Customers ─────────────────────────────────────────────────────────────
    // resolvedCustomerIds is populated here and consumed by the Leads transaction.

    const resolvedCustomerIds = new Map<string, string>(); // normalizedPhone → User.id

    const customerResult = await this.prisma.$transaction(async (tx) => {
      let created = 0, updated = 0, unchanged = 0;

      for (const c of plan.customers.ops) {
        if (c.op === 'unchanged') {
          unchanged++;
          if (c.id) resolvedCustomerIds.set(c.phone, c.id);
          continue;
        }

        if (c.op === 'create') {
          const e164 = canonicalPhone(c.phone, 'EG');
          if (!e164) {
            // c.phone passed normalizePhone earlier in this run, so canonicalPhone
            // must succeed — reaching here is a programming error, not user input.
            throw new Error(
              `[applyPlan] canonicalPhone("${c.phone}", "EG") returned null after normalizePhone passed — this is a bug, not a user error.`,
            );
          }
          const user = await (tx.user as any).create({
            data: {
              fullName: c.fullName!,
              phone: e164,
              email: c.email ?? null,
              locale: c.locale ?? Locale.ar,
              role: UserRole.CLIENT,
              companyId: plan.companyId,
              active: true,
            },
            select: { id: true },
          });
          resolvedCustomerIds.set(c.phone, user.id);
          created++;
        } else {
          // update — only fullName and locale are updatable
          const updateData: Record<string, unknown> = {};
          if (c.fullName !== undefined) updateData.fullName = c.fullName;
          if (c.locale   !== undefined) updateData.locale   = c.locale;

          await (tx.user as any).update({
            where: { id: c.id! },
            data: updateData,
          });
          resolvedCustomerIds.set(c.phone, c.id!);
          updated++;
        }
      }

      return { sheetName: CUSTOMERS_SHEET.name, created, updated, unchanged, locked: 0, warnings: [...plan.customers.warnings] };
    });

    // ── Leads ─────────────────────────────────────────────────────────────────

    const leadResult = await this.prisma.$transaction(async (tx) => {
      let created = 0, updated = 0, unchanged = 0, locked = 0;

      for (const l of plan.leads.ops) {
        if (l.op === 'unchanged') { unchanged++; continue; }
        if (l.op === 'locked')    { locked++;    continue; }

        if (l.op === 'create') {
          // Resolve clientId: either pre-resolved at parse time (existing customer)
          // or just created in the Customers transaction (new customer this run)
          const clientId = l.clientId ?? (l.phone ? resolvedCustomerIds.get(l.phone) : undefined);
          if (!clientId) continue; // should not happen if parseAndValidate validated correctly

          await (tx.lead as any).create({
            data: {
              companyId: plan.companyId,
              clientId,
              fullName: l.fullName!,
              phone: l.phone!,
              email: l.email ?? null,
              stage: l.stage ?? LeadStage.NEW,
              sourceId: l.sourceId ?? null,
              assignedSalesId: l.assignedSalesId ?? null,
              projectInterestId: l.projectInterestId ?? null,
              unitInterestId: l.unitInterestId ?? null,
            },
          });
          created++;
        } else {
          // update — only the updatable fields are written; undefined = column absent = skip
          const updateData: Record<string, unknown> = {};
          if (l.fullName          !== undefined) updateData.fullName = l.fullName;
          if (l.stage             !== undefined) updateData.stage = l.stage;
          if (l.sourceId          !== undefined) updateData.sourceId = l.sourceId;
          if (l.assignedSalesId   !== undefined) updateData.assignedSalesId = l.assignedSalesId;
          if (l.projectInterestId !== undefined) updateData.projectInterestId = l.projectInterestId;
          if (l.unitInterestId    !== undefined) updateData.unitInterestId = l.unitInterestId;

          await (tx.lead as any).update({
            where: { id: l.id! },
            data: updateData,
          });
          updated++;
        }
      }

      return { sheetName: LEADS_SHEET.name, created, updated, unchanged, locked: 0, warnings: [...plan.leads.warnings] };
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'DATA_IMPORT',
        entityType: 'data-import',
        entityId: plan.companyId,
        after: {
          projectsCreated:  projectResult.created,
          phasesCreated:    phaseResult.created,
          buildingsCreated: buildingResult.created,
          unitsCreated:     unitResult.created,
          customersCreated: customerResult.created,
          leadsCreated:     leadResult.created,
        } as object,
        companyId: plan.companyId,
      },
    });

    const totalCreated =
      projectResult.created + phaseResult.created + buildingResult.created + unitResult.created +
      customerResult.created + leadResult.created;
    const totalUpdated =
      projectResult.updated + phaseResult.updated + buildingResult.updated + unitResult.updated +
      customerResult.updated + leadResult.updated;
    const totalUnchanged =
      projectResult.unchanged + phaseResult.unchanged + buildingResult.unchanged + unitResult.unchanged +
      customerResult.unchanged + leadResult.unchanged;

    return {
      projects:  projectResult,
      phases:    phaseResult,
      buildings: buildingResult,
      units:     unitResult,
      customers: customerResult,
      leads:     leadResult,
      totalCreated,
      totalUpdated,
      totalUnchanged,
      unresolvedLeadSalesReps: plan.unresolvedLeadSalesReps,
    };
  }
}
