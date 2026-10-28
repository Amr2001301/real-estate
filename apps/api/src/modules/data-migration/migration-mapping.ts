import { LeadCallResult, LeadNoteKind, LeadStage, MigrationEntity } from '@prisma/client';
import { normalizeWord } from './migration-values';

/**
 * MG2 — the values a migration keeps for the platform owner to map, and what
 * each can map to. A fixed-list value (stage, activity kind, call result) is
 * the same for every company moved from a system; a company's own list
 * (lead source, unit type, person) is mapped per company.
 */
export type MappedKind = 'stage' | 'noteKind' | 'callResult' | 'source' | 'staff' | 'unitType';

export interface MappedField {
  entity: MigrationEntity;
  /** The key the import keeps the unrecognised value under (record.unmapped). */
  key: string;
  kind: MappedKind;
  /** System-wide (every company from that system) or per company. */
  scope: 'system' | 'company';
}

export const MAPPED_FIELDS: Record<string, MappedField> = {
  'LEAD.stage': { entity: MigrationEntity.LEAD, key: 'stage', kind: 'stage', scope: 'system' },
  'LEAD.source': { entity: MigrationEntity.LEAD, key: 'source', kind: 'source', scope: 'company' },
  'LEAD.assignedTo': { entity: MigrationEntity.LEAD, key: 'assignedTo', kind: 'staff', scope: 'company' },
  'ACTIVITY.kind': { entity: MigrationEntity.ACTIVITY, key: 'kind', kind: 'noteKind', scope: 'system' },
  'ACTIVITY.callResult': { entity: MigrationEntity.ACTIVITY, key: 'callResult', kind: 'callResult', scope: 'system' },
  'ACTIVITY.by': { entity: MigrationEntity.ACTIVITY, key: 'by', kind: 'staff', scope: 'company' },
  'UNIT.type': { entity: MigrationEntity.UNIT, key: 'type', kind: 'unitType', scope: 'company' },
};

/** Extra fields that can be put somewhere: a customer's into a customer field, a lead's into a note. */
export const EXTRA_ACTIONS: Partial<Record<MigrationEntity, 'CUSTOMER_FIELD' | 'NOTE'>> = {
  [MigrationEntity.CUSTOMER]: 'CUSTOMER_FIELD',
  [MigrationEntity.LEAD]: 'NOTE',
};

export const MAPPING_ACTIONS = ['MAP', 'IGNORE', 'NOTE', 'CUSTOMER_FIELD'] as const;
export type MappingAction = (typeof MAPPING_ACTIONS)[number];

export const extraField = (entity: MigrationEntity, key: string) => `${entity}.extra.${key}`;

/** The extra field a mapping key names, if it names one. */
export function parseExtraField(field: string): { entity: MigrationEntity; key: string } | null {
  const m = /^([A-Z]+)\.extra\.(.+)$/.exec(field);
  if (!m || !(Object.values(MigrationEntity) as string[]).includes(m[1]!)) return null;
  return { entity: m[1] as MigrationEntity, key: m[2]! };
}

/** The value as stored on a mapping: normalised, so «مهتم جداً» and «مهتم جدا» are one. */
export const mappingValue = (raw: string) => normalizeWord(raw).slice(0, 200);

/** The fixed lists a system-wide value can map to. */
export const FIXED_TARGETS: Record<'stage' | 'noteKind' | 'callResult', readonly string[]> = {
  stage: Object.values(LeadStage),
  noteKind: Object.values(LeadNoteKind),
  callResult: Object.values(LeadCallResult),
};

/** A saved choice, as the import and the screen read it. */
export interface SavedMapping {
  field: string;
  value: string;
  action: MappingAction;
  target: string | null;
  companyId: string | null;
}

/**
 * The mappings that hold for one company from one system, by field and
 * value: the company's own over the system-wide ones.
 */
export class MappingTable {
  private readonly byKey = new Map<string, SavedMapping>();

  constructor(rows: SavedMapping[]) {
    // System-wide first, so a company's own choice for the same key wins.
    for (const r of [...rows].sort((a, b) => (a.companyId ? 1 : 0) - (b.companyId ? 1 : 0))) {
      this.byKey.set(`${r.field}|${r.value}`, r);
    }
  }

  /** The mapping for a kept value (an unrecognised stage, source, person…). */
  of(field: string, raw: string): SavedMapping | undefined {
    return this.byKey.get(`${field}|${mappingValue(raw)}`);
  }

  /** The mapping for an extra field. */
  extra(entity: MigrationEntity, key: string): SavedMapping | undefined {
    return this.byKey.get(`${extraField(entity, key)}|`);
  }
}
