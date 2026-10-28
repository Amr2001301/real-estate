import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LeadNoteKind, LeadStage, MigrationEntity, Prisma, UnitStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { scopedUserFindMany } from '../../common/tenant/resolve-tenant-entity';
import { FALLBACK_SOURCE, STAFF_ROLES } from './data-migration.service';
import {
  EXTRA_ACTIONS,
  FIXED_TARGETS,
  MAPPED_FIELDS,
  MappingTable,
  extraField,
  mappingValue,
  parseExtraField,
  type MappingAction,
  type SavedMapping,
} from './migration-mapping';
import { normalizeWord } from './migration-values';
import type { SaveMappingDto } from './dto/data-migration.dto';

/** A group of records keeping the same value (or the same extra field). */
export interface KeptGroup {
  field: string;
  entity: MigrationEntity;
  /** The normalised value the mapping is keyed by ("" for an extra field). */
  value: string;
  /** The value as the other system wrote it (one of them). */
  sample: string;
  count: number;
  mapping: { action: MappingAction; target: string | null; systemWide: boolean } | null;
}

/** How many records a choice changed, and how many it left because someone changed them by hand. */
export interface ApplyResult {
  applied: number;
  kept: number;
  /** A choice for the author of an activity only holds for what is sent from now on. */
  futureOnly?: boolean;
}

const RECORD_CAP = 20_000;

/**
 * MG2 — the platform owner maps what a migration kept: an unrecognised value
 * (a stage, an activity kind, a source, a person, a unit type) or an extra
 * field. The choice is saved for the system and applied to the records
 * already moved, but never over a change someone made by hand since the move
 * (owner's decision, 2026-10-30): only a record still holding what the move
 * put there is changed. Later sends use the choice directly.
 *
 * Runs inside the company's tenant context (the controller wraps it).
 */
@Injectable()
export class MigrationMappingService {
  constructor(private readonly prisma: PrismaService) {}

  /** The mappings that hold for a company from a system. */
  async table(companyId: string, sourceSystem: string): Promise<MappingTable> {
    const rows = await this.prisma.migrationMapping.findMany({
      where: { sourceSystem, OR: [{ companyId: null }, { companyId }] },
      select: { field: true, value: true, action: true, target: true, companyId: true },
    });
    return new MappingTable(rows as SavedMapping[]);
  }

  /** The screen: the systems this company was moved from, what each kept, and the choices. */
  async screen(companyId: string, system?: string) {
    const runs = await this.prisma.migrationRun.findMany({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
      select: { sourceSystem: true, sourceLabel: true },
    });
    const systems = [...new Map(runs.map((r) => [r.sourceSystem, { sourceSystem: r.sourceSystem, sourceLabel: r.sourceLabel }])).values()];
    const sourceSystem = system && systems.some((s) => s.sourceSystem === system) ? system : systems[0]?.sourceSystem;
    if (!sourceSystem) return { systems, sourceSystem: null, groups: [], options: await this.options(companyId) };

    const [records, table] = await Promise.all([
      this.prisma.migrationRecord.findMany({
        where: {
          companyId,
          sourceSystem,
          OR: [{ unmapped: { not: Prisma.AnyNull } }, { extra: { not: Prisma.AnyNull } }],
        },
        select: { entity: true, unmapped: true, extra: true },
        take: RECORD_CAP,
      }),
      this.table(companyId, sourceSystem),
    ]);

    const groups = new Map<string, KeptGroup>();
    const add = (field: string, entity: MigrationEntity, value: string, sample: string) => {
      const id = `${field}|${value}`;
      const g = groups.get(id);
      if (g) g.count += 1;
      else groups.set(id, { field, entity, value, sample, count: 1, mapping: null });
    };
    for (const r of records) {
      const unmapped = asObject(r.unmapped);
      for (const [field, def] of Object.entries(MAPPED_FIELDS)) {
        const raw = def.entity === r.entity ? unmapped[def.key] : undefined;
        if (typeof raw === 'string' && raw.trim()) add(field, r.entity, mappingValue(raw), raw);
      }
      for (const [key, raw] of Object.entries(asObject(r.extra))) {
        add(extraField(r.entity, key), r.entity, '', String(raw ?? ''));
      }
    }
    for (const g of groups.values()) {
      const m = g.value ? table.of(g.field, g.value) : parseExtra(g.field, table);
      if (m) g.mapping = { action: m.action, target: m.target, systemWide: m.companyId === null };
    }
    const sorted = [...groups.values()].sort((a, b) => a.field.localeCompare(b.field) || b.count - a.count);
    return { systems, sourceSystem, groups: sorted, options: await this.options(companyId) };
  }

  /** Saves a choice and applies it to the records already moved. */
  async save(companyId: string, dto: SaveMappingDto, actorId: string): Promise<ApplyResult> {
    const { sourceSystem, field } = dto;
    if (!(await this.prisma.migrationRun.findFirst({ where: { companyId, sourceSystem }, select: { id: true } }))) {
      throw new NotFoundException('This company was not moved from that system');
    }
    const { value, rowCompanyId, action, target } = await this.check(companyId, dto);

    const where = { sourceSystem, companyId: rowCompanyId, field, value };
    const existing = await this.prisma.migrationMapping.findFirst({ where, select: { id: true } });
    if (existing) {
      await this.prisma.migrationMapping.update({ where: { id: existing.id }, data: { action, target, updatedById: actorId } });
    } else {
      await this.prisma.migrationMapping.create({ data: { ...where, action, target, updatedById: actorId } });
    }

    const result = action === 'IGNORE' ? { applied: 0, kept: 0 } : await this.apply(companyId, sourceSystem, field, value, target!);
    await this.prisma.auditLog.create({
      data: {
        companyId,
        actorId,
        action: 'MIGRATION_MAPPING_SAVED',
        entityType: 'migration-mapping',
        entityId: companyId,
        after: { sourceSystem, field, value, action, target, systemWide: rowCompanyId === null, ...result } as Prisma.InputJsonValue,
      },
    });
    return result;
  }

  // ── Checks ─────────────────────────────────────────────────────────────────

  private async check(companyId: string, dto: SaveMappingDto) {
    const action = dto.action as MappingAction;
    const def = MAPPED_FIELDS[dto.field];
    if (def) {
      if (action !== 'MAP' && action !== 'IGNORE') throw new BadRequestException('اختار قيمة هنا أو «تجاهل»');
      const value = mappingValue(dto.value ?? '');
      if (!value) throw new BadRequestException('value is required');
      const target = action === 'MAP' ? await this.checkTarget(companyId, def.kind, dto.target) : null;
      return { value, rowCompanyId: def.scope === 'system' ? null : companyId, action, target };
    }
    const extra = parseExtraField(dto.field);
    if (!extra) throw new BadRequestException(`Unknown field "${dto.field}"`);
    const allowed = EXTRA_ACTIONS[extra.entity];
    if (action !== 'IGNORE' && action !== allowed) throw new BadRequestException('This extra field can only be ignored');
    let target: string | null = null;
    if (action === 'CUSTOMER_FIELD') {
      const field = await this.prisma.customerField.findFirst({ where: { companyId, key: dto.target ?? '' }, select: { key: true } });
      if (!field) throw new BadRequestException('اختار حقل من حقول العملاء بتاعة الشركة');
      target = field.key;
    }
    return { value: '', rowCompanyId: companyId, action, target };
  }

  private async checkTarget(companyId: string, kind: string, target: string | undefined): Promise<string> {
    if (!target) throw new BadRequestException('target is required');
    if (kind === 'stage' || kind === 'noteKind' || kind === 'callResult') {
      if (FIXED_TARGETS[kind].includes(target)) return target;
    } else if (kind === 'source') {
      if (await this.prisma.leadSource.findFirst({ where: { id: target, companyId, active: true }, select: { id: true } })) return target;
    } else if (kind === 'unitType') {
      if (await this.prisma.unitType.findFirst({ where: { code: target, companyId, active: true }, select: { id: true } })) return target;
    } else if (kind === 'staff') {
      const staff = await scopedUserFindMany(this.prisma, { id: target, role: { in: STAFF_ROLES }, active: true }, { id: true });
      if (staff.length) return target;
    }
    throw new BadRequestException('This choice is not one of the company’s');
  }

  // ── Applying to what was already moved ─────────────────────────────────────

  /** The records of the system keeping this value (or this extra field), with what they became. */
  private async matching(companyId: string, sourceSystem: string, field: string, value: string) {
    const def = MAPPED_FIELDS[field];
    const extra = def ? null : parseExtraField(field);
    const entity = def?.entity ?? extra!.entity;
    const records = await this.prisma.migrationRecord.findMany({
      where: { companyId, sourceSystem, entity, ...(def ? { unmapped: { not: Prisma.AnyNull } } : { extra: { not: Prisma.AnyNull } }) },
      select: { targetId: true, unmapped: true, extra: true },
      take: RECORD_CAP,
    });
    if (def) {
      return records
        .filter((r) => {
          const raw = asObject(r.unmapped)[def.key];
          return typeof raw === 'string' && mappingValue(raw) === value;
        })
        .map((r) => ({ id: r.targetId, extra: undefined as unknown }));
    }
    return records
      .filter((r) => Object.prototype.hasOwnProperty.call(asObject(r.extra), extra!.key))
      .map((r) => ({ id: r.targetId, extra: asObject(r.extra)[extra!.key] }));
  }

  private async apply(companyId: string, sourceSystem: string, field: string, value: string, target: string): Promise<ApplyResult> {
    const rows = await this.matching(companyId, sourceSystem, field, value);
    const ids = rows.map((r) => r.id);
    if (ids.length === 0) return { applied: 0, kept: 0, ...(field === 'ACTIVITY.by' ? { futureOnly: true } : {}) };
    const done = (applied: number) => ({ applied, kept: ids.length - applied });
    const now = new Date();

    switch (field) {
      case 'LEAD.stage': {
        // Moved in as «جديد» because the stage was not known; one moved since stays.
        const target_ = target as LeadStage;
        const { count } = await this.prisma.lead.updateMany({
          where: { id: { in: ids }, companyId, stage: LeadStage.NEW },
          data: { stage: target_, stageChangedAt: now, ...(target_ === LeadStage.LOST ? { lostAt: now } : {}) },
        });
        return done(count);
      }
      case 'LEAD.source': {
        const fallback = await this.fallbackSourceId(companyId);
        if (!fallback) return done(0);
        const { count } = await this.prisma.lead.updateMany({
          where: { id: { in: ids }, companyId, sourceId: fallback },
          data: { sourceId: target },
        });
        return done(count);
      }
      case 'LEAD.assignedTo': {
        const { count } = await this.prisma.lead.updateMany({
          where: { id: { in: ids }, companyId, assignedSalesId: null },
          data: { assignedSalesId: target },
        });
        return done(count);
      }
      case 'ACTIVITY.kind': {
        const { count } = await this.prisma.leadNote.updateMany({
          where: { id: { in: ids }, companyId, kind: LeadNoteKind.NOTE },
          data: { kind: target as LeadNoteKind },
        });
        return done(count);
      }
      case 'ACTIVITY.callResult': {
        const { count } = await this.prisma.leadNote.updateMany({
          where: { id: { in: ids }, companyId, kind: LeadNoteKind.CALL, callResult: null },
          data: { callResult: target as Prisma.LeadNoteUpdateManyMutationInput['callResult'] },
        });
        return done(count);
      }
      case 'ACTIVITY.by':
        // Who wrote a note moved in without a known author can no longer be
        // told from a hand edit; the choice holds for what is sent from now on.
        return { applied: 0, kept: 0, futureOnly: true };
      case 'UNIT.type': {
        // Moved in with the company's first type; a unit retyped or sold since stays.
        const [first, chosen] = await Promise.all([
          this.prisma.unitType.findFirst({
            where: { companyId, active: true },
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
            select: { code: true },
          }),
          this.prisma.unitType.findFirst({ where: { companyId, code: target }, select: { code: true, usage: true } }),
        ]);
        if (!first || !chosen) return done(0);
        const { count } = await this.prisma.unit.updateMany({
          where: { id: { in: ids }, companyId, status: UnitStatus.AVAILABLE, type: first.code },
          data: { type: chosen.code, usage: chosen.usage },
        });
        return done(count);
      }
    }

    const extra = parseExtraField(field)!;
    if (extra.entity === MigrationEntity.CUSTOMER) return done(await this.intoCustomerField(companyId, rows, target));
    if (extra.entity === MigrationEntity.LEAD) return done(await this.intoLeadNote(companyId, rows, extra.key));
    return done(0);
  }

  /** An extra field into one of the company's customer fields, where the customer has no value there yet. */
  private async intoCustomerField(companyId: string, rows: { id: string; extra: unknown }[], key: string): Promise<number> {
    const customers = await scopedUserFindMany(this.prisma, { id: { in: rows.map((r) => r.id) } }, { id: true, customFields: true });
    let applied = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const c of customers) {
        const current = asObject(c.customFields);
        const value = rows.find((r) => r.id === c.id)?.extra;
        if (value === undefined || value === null || String(value).trim() === '') continue;
        if (current[key] !== undefined && current[key] !== null && String(current[key]).trim() !== '') continue;
        await tx.user.updateMany({
          where: { id: c.id, companyId },
          data: { customFields: { ...current, [key]: String(value) } as Prisma.InputJsonValue },
        });
        applied += 1;
      }
    });
    return applied;
  }

  /** An extra field as a note on the lead, once. */
  private async intoLeadNote(companyId: string, rows: { id: string; extra: unknown }[], key: string): Promise<number> {
    const leads = await this.prisma.lead.findMany({
      where: { id: { in: rows.map((r) => r.id) }, companyId },
      select: { id: true, assignedSalesId: true },
    });
    const admin = (await scopedUserFindMany(this.prisma, { role: UserRole.ADMIN, active: true }, { id: true }, { orderBy: { createdAt: 'asc' } }))[0];
    let applied = 0;
    for (const lead of leads) {
      const value = rows.find((r) => r.id === lead.id)?.extra;
      if (value === undefined || value === null || String(value).trim() === '') continue;
      const body = `${key}: ${String(value)}`;
      const authorId = lead.assignedSalesId ?? admin?.id;
      if (!authorId) continue;
      if (await this.prisma.leadNote.findFirst({ where: { companyId, leadId: lead.id, body }, select: { id: true } })) continue;
      await this.prisma.leadNote.create({
        data: { companyId, leadId: lead.id, salesId: authorId, body, kind: LeadNoteKind.NOTE },
      });
      applied += 1;
    }
    return applied;
  }

  private async fallbackSourceId(companyId: string): Promise<string | undefined> {
    const sources = await this.prisma.leadSource.findMany({ where: { companyId }, select: { id: true, name: true } });
    const word = normalizeWord(FALLBACK_SOURCE.en);
    return sources.find((s) => {
      const n = asObject(s.name);
      return [n.ar, n.en].some((w) => typeof w === 'string' && normalizeWord(w) === word);
    })?.id;
  }

  // ── What a value can map to ────────────────────────────────────────────────

  private async options(companyId: string) {
    const [sources, unitTypes, staff, customerFields] = await Promise.all([
      this.prisma.leadSource.findMany({ where: { companyId, active: true }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true } }),
      this.prisma.unitType.findMany({
        where: { companyId, active: true },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        select: { code: true, name: true },
      }),
      scopedUserFindMany(this.prisma, { role: { in: STAFF_ROLES }, active: true }, { id: true, fullName: true, role: true }, { orderBy: { createdAt: 'asc' } }),
      this.prisma.customerField.findMany({ where: { companyId, active: true }, orderBy: { order: 'asc' }, select: { key: true, label: true } }),
    ]);
    return {
      stages: FIXED_TARGETS.stage,
      noteKinds: FIXED_TARGETS.noteKind,
      callResults: FIXED_TARGETS.callResult,
      sources,
      unitTypes,
      staff,
      customerFields,
    };
  }
}

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function parseExtra(field: string, table: MappingTable) {
  const e = parseExtraField(field);
  return e ? table.extra(e.entity, e.key) : undefined;
}
