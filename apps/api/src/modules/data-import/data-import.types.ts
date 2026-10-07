import { LeadStage, Locale, ProjectStatus, UnitStatus } from '@prisma/client';

// 'locked' = existing unit has an active contract or reservation; entire row skipped
export type ImportOp = 'create' | 'update' | 'unchanged' | 'locked';

export interface ImportError {
  sheet: string;
  rowNumber: number;
  column?: string;
  message: string;
}

export interface ImportWarning {
  sheet: string;
  rowNumber: number;
  column?: string;
  message: string;
}

// ── Per-entity plan rows ───────────────────────────────────────────────────────
// undefined = column absent in file (don't touch on update)
// null      = column present, cell empty — valid only for translatable JSON sub-fields;
//             non-nullable scalars use undefined for empty cells (same as absent)

export interface ProjectPlan {
  rowNumber: number;
  op: ImportOp;
  code: string;
  id?: string;
  nameAr?: string | null;
  nameEn?: string | null;
  descAr?: string | null;
  descEn?: string | null;
  city?: string;
  status?: ProjectStatus;
}

export interface PhasePlan {
  rowNumber: number;
  op: ImportOp;
  code: string;
  projectCode: string;
  id?: string;
  projectId?: string;
  nameAr?: string | null;
  nameEn?: string | null;
  order?: number;
}

export interface BuildingPlan {
  rowNumber: number;
  op: ImportOp;
  code: string;
  projectCode: string;
  phaseCode: string;
  id?: string;
  phaseId?: string;
  name?: string;
  order?: number;
  totalFloors?: number;
}

export interface UnitPlan {
  rowNumber: number;
  op: ImportOp;
  code: string;
  projectCode: string;
  phaseCode: string;
  buildingCode: string;
  id?: string;
  buildingId?: string;
  type?: string;
  floor?: number;
  area?: number;
  bedrooms?: number;
  bathrooms?: number;
  price?: number;
  status?: UnitStatus;
}

export interface CustomerPlan {
  rowNumber: number;
  op: ImportOp;
  /** Normalized 11-digit phone — the match key; never updated on existing rows. */
  phone: string;
  /** User.id if the customer already exists in the DB. */
  id?: string;
  /** Required for create; undefined = column absent = no update. */
  fullName?: string;
  /** Create-only: email is a potential future auth credential; updates are blocked. */
  email?: string | null;
  /** Optional on create (defaults to 'ar'); updatable. */
  locale?: Locale;
}

export interface LeadPlan {
  rowNumber: number;
  op: ImportOp;
  /** _ImportId from the file (= Lead.id UUID), present when the column is non-empty. */
  importId?: string;
  /** Lead.id when an existing lead was matched. */
  id?: string;
  /**
   * Normalized phone — used to look up clientId at apply time when the customer
   * is being created in the same import run (clientId is undefined in that case).
   */
  phone?: string;
  /**
   * Resolved User.id of the linked CLIENT user.
   * undefined when the customer is new in this run and will be created in the
   * Customers transaction; resolved at applyPlan time via resolvedCustomerIds.
   */
  clientId?: string;
  // ── Updatable fields ───────────────────────────────────────────────────────
  // undefined = column absent in file (leave unchanged on update)
  // null      = resolved FK cleared (unresolvable reference → null + warning)
  fullName?: string;
  email?: string | null;   // create-only; on update always undefined
  stage?: LeadStage;
  sourceId?: string | null;
  assignedSalesId?: string | null;
  projectInterestId?: string | null;
  unitInterestId?: string | null;
}

export interface SheetPlan<T> {
  sheetName: string;
  ops: T[];
  errors: ImportError[];
  warnings: ImportWarning[];
  errorCount: number;
}

export interface ImportPlan {
  companyId: string;
  projects: SheetPlan<ProjectPlan>;
  phases: SheetPlan<PhasePlan>;
  buildings: SheetPlan<BuildingPlan>;
  units: SheetPlan<UnitPlan>;
  customers: SheetPlan<CustomerPlan>;
  leads: SheetPlan<LeadPlan>;
  hasErrors: boolean;
  /** Leads rows where the named sales rep could not be resolved (0 or 2+ matches). */
  unresolvedLeadSalesReps: number;
}

export interface SheetResult {
  sheetName: string;
  created: number;
  updated: number;
  unchanged: number;
  locked: number;
  warnings: ImportWarning[];
}

export interface ImportResult {
  projects: SheetResult;
  phases: SheetResult;
  buildings: SheetResult;
  units: SheetResult;
  customers: SheetResult;
  leads: SheetResult;
  totalCreated: number;
  totalUpdated: number;
  totalUnchanged: number;
  /** Leads rows where the named sales rep could not be resolved (0 or 2+ matches). */
  unresolvedLeadSalesReps: number;
}
