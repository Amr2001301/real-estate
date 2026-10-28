import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { plainToInstance } from 'class-transformer';
import { getMetadataStorage, validate } from 'class-validator';
import {
  LeadNoteKind,
  LeadStage,
  MigrationEntity,
  Prisma,
  ProjectStatus,
  UnitStatus,
  UserRole,
  type MigrationRun,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { scopedUserFindMany } from '../../common/tenant/resolve-tenant-entity';
import { ENTITY_CODE_PATTERN } from '../../common/utils/entity-code';
import { canonicalEmail, canonicalPhone } from '../../common/utils/identity-normalize';
import { phoneForWrite } from '../../common/utils/phone-for-write';
import {
  CreateMigrationRunDto,
  MigrationActivityItem,
  MigrationCustomerItem,
  MigrationLeadItem,
  MigrationProjectItem,
  MigrationUnitItem,
} from './dto/data-migration.dto';
import { callResultOf, leadStageOf, normalizeWord, noteKindOf, projectStatusOf, unitStatusOf } from './migration-values';

const hash = (key: string) => createHash('sha256').update(key).digest('hex');
const newKey = () => `mk_${randomBytes(24).toString('base64url')}`;
const DAY = 24 * 60 * 60 * 1000;

/** The lead source a migrated lead is filed under when its own is not one of the company's. */
const FALLBACK_SOURCE = { ar: 'نقل بيانات', en: 'Data migration' };
const STAFF_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES];
const CUSTOMER_ROLES: UserRole[] = [UserRole.CLIENT, UserRole.CUSTOMER];
const EXTRA_MAX_KEYS = 100;
const EXTRA_MAX_VALUE = 2000;

export const MIGRATION_ENTITY_BY_PATH = {
  projects: MigrationEntity.PROJECT,
  units: MigrationEntity.UNIT,
  customers: MigrationEntity.CUSTOMER,
  leads: MigrationEntity.LEAD,
  activities: MigrationEntity.ACTIVITY,
} as const;
export type MigrationPath = keyof typeof MIGRATION_ENTITY_BY_PATH;

const ITEM_CLASS = {
  PROJECT: MigrationProjectItem,
  UNIT: MigrationUnitItem,
  CUSTOMER: MigrationCustomerItem,
  LEAD: MigrationLeadItem,
  ACTIVITY: MigrationActivityItem,
} as const;

type Tx = Prisma.TransactionClient;

export interface MigrationItemResult {
  externalId: string | null;
  status: 'created' | 'updated' | 'error';
  id?: string;
  errors?: string[];
  warnings?: string[];
  /** Fields kept for the platform owner to map: extra data, unrecognised values. */
  kept?: { extra: string[]; unmapped: string[] };
}

interface Handled {
  status: 'created' | 'updated';
  id: string;
  warnings: string[];
  unmapped: Record<string, string>;
}

/** What a request matches against, loaded once per request. */
interface Lookup {
  companyId: string;
  country: string;
  sources: { id: string; words: string[] }[];
  unitTypes: { code: string; usage: Prisma.UnitCreateInput['usage']; words: string[] }[];
  staff: { id: string; email: string | null; phone: string | null; role: UserRole }[];
  fallbackSourceId?: string;
  /** Made inside the current record's transaction: kept only once it commits. */
  pendingSourceId?: string;
}

/** Thrown at the end of a dry run's transaction so nothing it wrote stays. */
class DryRunRollback extends Error {
  constructor(readonly result: Handled) {
    super('dry run');
  }
}

/**
 * A company's data moved in from another system, over the API.
 *
 * The platform owner opens a run for a company and hands the other system its
 * key (shown once) and the company's address. That system sends its records in lists — projects, units,
 * customers, leads, then the leads' activities — each with its own id there.
 * Every record is checked on its own: a bad one is reported and the rest go
 * in. A record sent again updates what it became here, so a move can be
 * repeated or resumed. A dry run checks everything and keeps nothing.
 *
 * Nothing sent is lost: fields with no place here (`extra`, and any field not
 * in the format) and values not recognised (a stage, a source, a unit type,
 * a person) are kept on the record for the platform owner to map.
 *
 * Moved-in data is history: no notifications, no hand-out to reps, no first
 * call — exactly as it was in the other system.
 */
@Injectable()
export class DataMigrationService {
  private readonly logger = new Logger(DataMigrationService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Platform owner ─────────────────────────────────────────────────────────

  async listRuns(companyId: string) {
    const { slug } = await this.assertCompany(companyId);
    const runs = await this.prisma.migrationRun.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      select: RUN_SELECT,
    });
    const ids = runs.map((r) => r.id);
    if (ids.length === 0) return { companySlug: slug, runs: [] };
    const [byEntity, unmapped, extra] = await Promise.all([
      this.prisma.migrationRecord.groupBy({
        by: ['runId', 'entity'],
        where: { companyId, runId: { in: ids } },
        _count: { _all: true },
      }),
      this.prisma.migrationRecord.groupBy({
        by: ['runId'],
        where: { companyId, runId: { in: ids }, unmapped: { not: Prisma.AnyNull } },
        _count: { _all: true },
      }),
      this.prisma.migrationRecord.groupBy({
        by: ['runId'],
        where: { companyId, runId: { in: ids }, extra: { not: Prisma.AnyNull } },
        _count: { _all: true },
      }),
    ]);
    const withCounts = runs.map((r) => {
      const counts = Object.fromEntries(Object.values(MigrationEntity).map((e) => [e, 0])) as Record<MigrationEntity, number>;
      for (const g of byEntity) if (g.runId === r.id) counts[g.entity] = g._count._all;
      return {
        ...r,
        state: runState(r),
        counts,
        withUnmapped: unmapped.find((g) => g.runId === r.id)?._count._all ?? 0,
        withExtra: extra.find((g) => g.runId === r.id)?._count._all ?? 0,
      };
    });
    return { companySlug: slug, runs: withCounts };
  }

  /** A new run; its key is returned this once and only its hash kept. */
  async createRun(companyId: string, dto: CreateMigrationRunDto, actorId: string) {
    await this.assertCompany(companyId);
    const sourceSystem = dto.sourceSystem ?? slugOf(dto.sourceLabel);
    if (!sourceSystem) {
      throw new BadRequestException('اكتب اسم النظام بالإنجليزي (sourceSystem) — مثلاً engaz');
    }
    const key = newKey();
    const run = await this.prisma.migrationRun.create({
      data: {
        companyId,
        sourceSystem,
        sourceLabel: dto.sourceLabel,
        tokenHash: hash(key),
        tokenPrefix: key.slice(0, 9),
        expiresAt: new Date(Date.now() + (dto.days ?? 7) * DAY),
        note: dto.note ?? null,
        createdById: actorId,
      },
      select: RUN_SELECT,
    });
    await this.audit(companyId, actorId, 'MIGRATION_RUN_CREATED', run.id, { sourceSystem, expiresAt: run.expiresAt });
    return { ...run, state: runState(run), key };
  }

  /** The move is done: the key stops working; what came in stays. */
  async finishRun(companyId: string, runId: string, actorId: string) {
    const run = await this.prisma.migrationRun.findFirst({ where: { id: runId, companyId }, select: { id: true, status: true } });
    if (!run) throw new NotFoundException('Migration run not found');
    if (run.status === 'OPEN') {
      await this.prisma.migrationRun.updateMany({
        where: { id: runId, companyId, status: 'OPEN' },
        data: { status: 'FINISHED', finishedAt: new Date() },
      });
      await this.audit(companyId, actorId, 'MIGRATION_RUN_FINISHED', runId, {});
    }
    return { ok: true };
  }

  /** The records of a run: all, or those carrying extra data or unrecognised values. */
  async listRecords(companyId: string, runId: string, entity?: MigrationEntity, kept?: 'extra' | 'unmapped') {
    if (!(await this.prisma.migrationRun.findFirst({ where: { id: runId, companyId }, select: { id: true } }))) {
      throw new NotFoundException('Migration run not found');
    }
    return this.prisma.migrationRecord.findMany({
      where: {
        companyId,
        runId,
        ...(entity ? { entity } : {}),
        ...(kept === 'extra' ? { extra: { not: Prisma.AnyNull } } : {}),
        ...(kept === 'unmapped' ? { unmapped: { not: Prisma.AnyNull } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
      select: { id: true, entity: true, externalId: true, targetId: true, extra: true, unmapped: true, updatedAt: true },
    });
  }

  // ── The other system ───────────────────────────────────────────────────────

  /** The company a migration is sent to: active, by its slug in the address. */
  async companyBySlug(slug: string): Promise<string> {
    const company = await this.prisma.company.findFirst({
      where: { slug: slug.trim().toLowerCase(), isActive: true },
      select: { id: true },
    });
    if (!company) throw new NotFoundException('Company not found');
    return company.id;
  }

  /** The company's open run the key belongs to (inside the company's context). */
  async runForKey(rawKey: string | undefined, companyId: string): Promise<MigrationRun> {
    if (!rawKey) throw new UnauthorizedException('Missing migration key (X-Migration-Key)');
    const run = await this.prisma.migrationRun.findFirst({ where: { companyId, tokenHash: hash(rawKey) } });
    if (!run || run.status !== 'OPEN') throw new UnauthorizedException('Invalid or finished migration key');
    if (run.expiresAt.getTime() <= Date.now()) throw new UnauthorizedException('This migration key has expired');
    return run;
  }

  async status(run: MigrationRun) {
    const companyId = run.companyId!;
    const [company, byEntity] = await Promise.all([
      this.prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }),
      this.prisma.migrationRecord.groupBy({
        by: ['entity'],
        where: { companyId, sourceSystem: run.sourceSystem },
        _count: { _all: true },
      }),
    ]);
    return {
      company: company?.name ?? null,
      sourceSystem: run.sourceSystem,
      sourceLabel: run.sourceLabel,
      expiresAt: run.expiresAt,
      received: Object.fromEntries(
        Object.values(MigrationEntity).map((e) => [e, byEntity.find((g) => g.entity === e)?._count._all ?? 0]),
      ),
    };
  }

  async ingest(run: MigrationRun, path: MigrationPath, items: unknown[], dryRun: boolean) {
    const companyId = run.companyId!;
    const entity = MIGRATION_ENTITY_BY_PATH[path];
    const lookup = await this.lookup(companyId);
    const results: MigrationItemResult[] = [];
    for (const raw of items) {
      results.push(
        raw && typeof raw === 'object' && !Array.isArray(raw)
          ? await this.one(run, entity, raw as Record<string, unknown>, dryRun, lookup)
          : { externalId: null, status: 'error', errors: ['Each item must be an object'] },
      );
    }
    if (!dryRun) {
      await this.prisma.migrationRun.updateMany({ where: { id: run.id, companyId }, data: { lastUsedAt: new Date() } });
    }
    return {
      dryRun,
      received: items.length,
      created: results.filter((r) => r.status === 'created').length,
      updated: results.filter((r) => r.status === 'updated').length,
      failed: results.filter((r) => r.status === 'error').length,
      results,
    };
  }

  private async one(
    run: MigrationRun,
    entity: MigrationEntity,
    raw: Record<string, unknown>,
    dryRun: boolean,
    lookup: Lookup,
  ): Promise<MigrationItemResult> {
    lookup.pendingSourceId = undefined;
    const externalId = typeof raw.externalId === 'string' || typeof raw.externalId === 'number' ? String(raw.externalId).trim() : null;
    const cls = ITEM_CLASS[entity] as new () => { externalId: string };
    const { known, extra, problems } = splitItem(cls, raw);
    const item = plainToInstance(cls, known, { enableImplicitConversion: true }) as { externalId: string };
    const errors = [...problems, ...(await validate(item, { whitelist: true, forbidNonWhitelisted: true })).flatMap(messagesOf)];
    if (errors.length) return { externalId, status: 'error', errors };

    try {
      const handled = await this.prisma.$transaction(async (tx) => {
        const record = await tx.migrationRecord.findFirst({
          where: { companyId: lookup.companyId, sourceSystem: run.sourceSystem, entity, externalId: item.externalId },
        });
        const out = await this.handlers[entity](tx, item as never, record?.targetId ?? null, run, lookup);
        const data = {
          runId: run.id,
          targetId: out.id,
          // A field sent again replaces what was kept; one not sent this time stays.
          ...(Object.keys(extra).length ? { extra: extra as Prisma.InputJsonValue } : {}),
          unmapped: Object.keys(out.unmapped).length ? (out.unmapped as Prisma.InputJsonValue) : Prisma.DbNull,
        };
        if (record) {
          await tx.migrationRecord.updateMany({ where: { id: record.id, companyId: lookup.companyId }, data });
        } else {
          await tx.migrationRecord.create({
            data: { ...data, companyId: lookup.companyId, sourceSystem: run.sourceSystem, entity, externalId: item.externalId },
          });
        }
        if (dryRun) throw new DryRunRollback(out);
        return out;
      });
      if (lookup.pendingSourceId) lookup.fallbackSourceId = lookup.pendingSourceId;
      return resultOf(item.externalId, handled, extra);
    } catch (err) {
      if (err instanceof DryRunRollback) return resultOf(item.externalId, err.result, extra);
      return { externalId, status: 'error', errors: [this.errorText(err)] };
    }
  }

  private readonly handlers: Record<
    MigrationEntity,
    (tx: Tx, item: never, targetId: string | null, run: MigrationRun, lookup: Lookup) => Promise<Handled>
  > = {
    PROJECT: (tx, item, targetId, _run, lookup) => this.project(tx, item, targetId, lookup),
    UNIT: (tx, item, targetId, run, lookup) => this.unit(tx, item, targetId, run, lookup),
    CUSTOMER: (tx, item, targetId, _run, lookup) => this.customer(tx, item, targetId, lookup),
    LEAD: (tx, item, targetId, run, lookup) => this.lead(tx, item, targetId, run, lookup),
    ACTIVITY: (tx, item, targetId, run, lookup) => this.activity(tx, item, targetId, run, lookup),
  };

  // ── Projects ───────────────────────────────────────────────────────────────

  private async project(tx: Tx, item: MigrationProjectItem, targetId: string | null, lookup: Lookup): Promise<Handled> {
    const { companyId } = lookup;
    const warnings: string[] = [];
    const unmapped: Record<string, string> = {};
    let existing = targetId ? await tx.project.findFirst({ where: { id: targetId, companyId }, select: { id: true, code: true } }) : null;
    // A project the company already has, named by its code, is taken over.
    if (!existing && item.code) {
      existing = await tx.project.findFirst({ where: { companyId, code: item.code }, select: { id: true, code: true } });
    }

    const status = projectStatusOf(item.status);
    if (item.status && !status) unmapped.status = item.status;
    const name = { ar: item.name, en: item.nameEn ?? item.name };

    if (existing) {
      if (item.code && item.code !== existing.code) await assertFreeProjectCode(tx, companyId, item.code);
      await tx.project.updateMany({
        where: { id: existing.id, companyId },
        data: {
          name,
          ...(item.code ? { code: item.code } : {}),
          ...(item.city !== undefined ? { city: item.city } : {}),
          ...(item.description !== undefined ? { description: { ar: item.description, en: item.description } } : {}),
        },
      });
      return { status: 'updated', id: existing.id, warnings, unmapped };
    }

    let code = item.code;
    if (code) await assertFreeProjectCode(tx, companyId, code);
    else code = await freeProjectCode(tx, companyId, codeFrom(item.externalId, 'P'));
    // A moved-in project starts hidden from the website: it has no photos or
    // map pin yet. The admin publishes it once it is ready.
    if (status === ProjectStatus.PUBLISHED) warnings.push('Created as a draft: publish it from the dashboard once it has photos and a location');
    const project = await tx.project.create({
      data: {
        companyId,
        code,
        name,
        description: { ar: item.description ?? '', en: item.description ?? '' },
        city: item.city ?? '',
        lat: 0,
        lng: 0,
        status: status === ProjectStatus.ARCHIVED ? ProjectStatus.ARCHIVED : ProjectStatus.DRAFT,
      },
      select: { id: true },
    });
    return { status: 'created', id: project.id, warnings, unmapped };
  }

  // ── Units ──────────────────────────────────────────────────────────────────

  private async unit(tx: Tx, item: MigrationUnitItem, targetId: string | null, run: MigrationRun, lookup: Lookup): Promise<Handled> {
    const { companyId } = lookup;
    const warnings: string[] = [];
    const unmapped: Record<string, string> = {};

    const projectId = await this.targetOf(tx, run, lookup, MigrationEntity.PROJECT, item.projectExternalId);
    if (!projectId) throw new BadRequestException(`Project "${item.projectExternalId}" has not been sent yet — send the projects first`);

    const status = unitStatusOf(item.status);
    if (status === 'TAKEN') {
      throw new BadRequestException(
        'The unit is sold or booked in the other system: here a unit is sold only by a contract and booked only by a reservation — enter that deal in the dashboard instead',
      );
    }
    if (item.status && !status) unmapped.status = item.status;

    let type = lookup.unitTypes[0];
    if (item.type) {
      const word = normalizeWord(item.type);
      const match = lookup.unitTypes.find((t) => t.words.includes(word));
      if (match) type = match;
      else unmapped.type = item.type;
    }
    if (!type) throw new BadRequestException('The company has no unit types — add one in the dashboard first');

    const fields = {
      ...(item.area !== undefined ? { area: item.area } : {}),
      ...(item.price !== undefined ? { price: new Prisma.Decimal(item.price) } : {}),
      ...(item.floor !== undefined ? { floor: item.floor } : {}),
      ...(item.bedrooms !== undefined ? { bedrooms: item.bedrooms } : {}),
      ...(item.bathrooms !== undefined ? { bathrooms: item.bathrooms } : {}),
    };

    let existing = targetId
      ? await tx.unit.findFirst({ where: { id: targetId, companyId }, select: { id: true, status: true, buildingId: true, code: true } })
      : null;
    let buildingId = existing?.buildingId;
    if (!existing) {
      const phaseId = await findOrCreatePhase(tx, companyId, projectId, item.phase);
      buildingId = await findOrCreateBuilding(tx, companyId, phaseId, item.building, item.floor);
      // A unit the company already has in that building, by its code, is taken over.
      existing = await tx.unit.findFirst({
        where: { companyId, buildingId, code: item.code },
        select: { id: true, status: true, buildingId: true, code: true },
      });
    }

    if (existing) {
      if (existing.status !== UnitStatus.AVAILABLE) {
        throw new BadRequestException('The unit has a reservation or a contract here — it is no longer changed by the migration');
      }
      if (item.code !== existing.code) {
        const taken = await tx.unit.findFirst({ where: { companyId, buildingId: existing.buildingId, code: item.code }, select: { id: true } });
        if (taken) throw new BadRequestException(`Unit code "${item.code}" is taken in this building`);
      }
      await tx.unit.updateMany({
        where: { id: existing.id, companyId, status: UnitStatus.AVAILABLE },
        data: { ...fields, code: item.code, ...(item.type && !unmapped.type ? { type: type.code, usage: type.usage } : {}) },
      });
      return { status: 'updated', id: existing.id, warnings, unmapped };
    }

    if (item.area === undefined) warnings.push('No area sent: set to 0');
    if (item.price === undefined) warnings.push('No price sent: set to 0');
    const unit = await tx.unit.create({
      data: {
        companyId,
        buildingId: buildingId!,
        code: item.code,
        type: type.code,
        usage: type.usage,
        area: item.area ?? 0,
        price: new Prisma.Decimal(item.price ?? 0),
        floor: item.floor ?? 0,
        bedrooms: item.bedrooms ?? 0,
        bathrooms: item.bathrooms ?? 0,
        status: UnitStatus.AVAILABLE,
      },
      select: { id: true },
    });
    return { status: 'created', id: unit.id, warnings, unmapped };
  }

  // ── Customers ──────────────────────────────────────────────────────────────

  private async customer(tx: Tx, item: MigrationCustomerItem, targetId: string | null, lookup: Lookup): Promise<Handled> {
    const { companyId } = lookup;
    const phone = await this.phone(item.phone, lookup);
    const birthDate = item.birthDate ? dayOf(item.birthDate, 'birthDate') : undefined;
    const data = {
      fullName: item.fullName,
      phone,
      ...(item.email !== undefined ? { email: canonicalEmail(item.email) } : {}),
      ...(item.nationalId !== undefined ? { nationalId: item.nationalId } : {}),
      ...(item.address !== undefined ? { address: item.address } : {}),
      ...(birthDate !== undefined ? { birthDate } : {}),
      ...(item.occupation !== undefined ? { occupation: item.occupation } : {}),
      ...(item.employer !== undefined ? { employer: item.employer } : {}),
    };

    let existing = targetId ? await tx.user.findFirst({ where: { id: targetId, companyId }, select: { id: true, role: true } }) : null;
    if (!existing) existing = await tx.user.findFirst({ where: { companyId, phone }, select: { id: true, role: true } });
    if (existing && !CUSTOMER_ROLES.includes(existing.role)) {
      throw new BadRequestException('This phone belongs to a staff member of the company');
    }
    if (existing) {
      await tx.user.updateMany({ where: { id: existing.id, companyId }, data });
      return { status: 'updated', id: existing.id, warnings: [], unmapped: {} };
    }
    const user = await tx.user.create({
      data: { ...data, companyId, role: UserRole.CLIENT, active: true },
      select: { id: true },
    });
    return { status: 'created', id: user.id, warnings: [], unmapped: {} };
  }

  // ── Leads ──────────────────────────────────────────────────────────────────

  private async lead(tx: Tx, item: MigrationLeadItem, targetId: string | null, run: MigrationRun, lookup: Lookup): Promise<Handled> {
    const { companyId } = lookup;
    const warnings: string[] = [];
    const unmapped: Record<string, string> = {};
    const phone = await this.phone(item.phone, lookup);

    const stage = leadStageOf(item.stage);
    if (item.stage && !stage) unmapped.stage = item.stage;

    let sourceId: string | undefined;
    if (item.source) {
      const word = normalizeWord(item.source);
      sourceId = lookup.sources.find((s) => s.words.includes(word))?.id;
      if (!sourceId) unmapped.source = item.source;
    }

    let assignedSalesId: string | undefined;
    if (item.assignedTo) {
      assignedSalesId = this.staffOf(item.assignedTo, lookup)?.id;
      if (!assignedSalesId) unmapped.assignedTo = item.assignedTo;
    }

    const projectInterestId = item.projectExternalId
      ? await this.targetOf(tx, run, lookup, MigrationEntity.PROJECT, item.projectExternalId)
      : undefined;
    if (item.projectExternalId && !projectInterestId) warnings.push(`Project "${item.projectExternalId}" was not sent: no project interest set`);
    const unitInterestId = item.unitExternalId
      ? await this.targetOf(tx, run, lookup, MigrationEntity.UNIT, item.unitExternalId)
      : undefined;
    if (item.unitExternalId && !unitInterestId) warnings.push(`Unit "${item.unitExternalId}" was not sent: no unit interest set`);

    let createdAt = item.createdAt ? new Date(item.createdAt) : undefined;
    if (createdAt && createdAt.getTime() > Date.now()) {
      warnings.push('createdAt is in the future: today is used');
      createdAt = undefined;
    }
    const nextActionAt = item.nextActionAt ? new Date(item.nextActionAt) : undefined;

    const existing = targetId
      ? await tx.lead.findFirst({ where: { id: targetId, companyId }, select: { id: true, stage: true, lostAt: true } })
      : null;
    if (existing) {
      const newStage = stage ?? undefined;
      await tx.lead.updateMany({
        where: { id: existing.id, companyId },
        data: {
          fullName: item.fullName,
          phone,
          ...(item.email !== undefined ? { email: canonicalEmail(item.email) } : {}),
          ...(newStage ? { stage: newStage } : {}),
          ...(newStage === LeadStage.LOST && !existing.lostAt ? { lostAt: new Date() } : {}),
          ...(newStage && newStage !== LeadStage.LOST ? { lostAt: null, lostReasonId: null, lostNote: null } : {}),
          ...(sourceId ? { sourceId } : {}),
          ...(assignedSalesId ? { assignedSalesId } : {}),
          ...(projectInterestId ? { projectInterestId } : {}),
          ...(unitInterestId ? { unitInterestId } : {}),
          ...(nextActionAt ? { nextActionAt, nextActionType: 'FOLLOW_UP' as const } : {}),
        },
      });
      return { status: 'updated', id: existing.id, warnings, unmapped };
    }

    const clientId = await this.clientFor(tx, item, phone, lookup);
    const at = createdAt ?? new Date();
    const lead = await tx.lead.create({
      data: {
        companyId,
        clientId,
        fullName: item.fullName,
        phone,
        email: item.email ? canonicalEmail(item.email) : null,
        stage: stage ?? LeadStage.NEW,
        sourceId: sourceId ?? (await this.fallbackSource(tx, lookup)),
        assignedSalesId: assignedSalesId ?? null,
        projectInterestId: projectInterestId ?? null,
        unitInterestId: unitInterestId ?? null,
        createdAt: at,
        stageChangedAt: at,
        nextActionAt: nextActionAt ?? null,
        nextActionType: nextActionAt ? 'FOLLOW_UP' : null,
        lostAt: stage === LeadStage.LOST ? at : null,
      },
      select: { id: true },
    });
    await tx.leadActivity.create({
      data: {
        companyId,
        leadId: lead.id,
        type: 'created',
        payload: { via: 'data-migration', sourceSystem: run.sourceSystem, externalId: item.externalId },
        createdAt: at,
      },
    });
    if (item.note) {
      await tx.leadNote.create({
        data: {
          companyId,
          leadId: lead.id,
          salesId: assignedSalesId ?? (await this.fallbackAuthor(tx, lookup)),
          body: item.note,
          kind: LeadNoteKind.NOTE,
          createdAt: at,
        },
      });
    }
    return { status: 'created', id: lead.id, warnings, unmapped };
  }

  /** The lead's person: a customer of the company by phone, or a new one. */
  private async clientFor(tx: Tx, item: MigrationLeadItem, phone: string, lookup: Lookup): Promise<string> {
    const user = await tx.user.findFirst({ where: { companyId: lookup.companyId, phone }, select: { id: true, role: true } });
    if (user && !CUSTOMER_ROLES.includes(user.role)) throw new BadRequestException('This phone belongs to a staff member of the company');
    if (user) return user.id;
    const created = await tx.user.create({
      data: {
        companyId: lookup.companyId,
        fullName: item.fullName,
        phone,
        email: item.email ? canonicalEmail(item.email) : null,
        role: UserRole.CLIENT,
        active: true,
      },
      select: { id: true },
    });
    return created.id;
  }

  // ── Activities ─────────────────────────────────────────────────────────────

  private async activity(tx: Tx, item: MigrationActivityItem, targetId: string | null, run: MigrationRun, lookup: Lookup): Promise<Handled> {
    const { companyId } = lookup;
    const unmapped: Record<string, string> = {};
    const leadId = await this.targetOf(tx, run, lookup, MigrationEntity.LEAD, item.leadExternalId);
    const lead = leadId ? await tx.lead.findFirst({ where: { id: leadId, companyId }, select: { id: true, assignedSalesId: true } }) : null;
    if (!lead) throw new BadRequestException(`Lead "${item.leadExternalId}" has not been sent yet — send the leads first`);

    const kind = noteKindOf(item.kind);
    if (item.kind && !kind) unmapped.kind = item.kind;
    const finalKind = kind ?? LeadNoteKind.NOTE;
    const callResult = finalKind === LeadNoteKind.CALL ? callResultOf(item.callResult) : undefined;
    if (item.callResult && finalKind === LeadNoteKind.CALL && !callResult) unmapped.callResult = item.callResult;

    let salesId = item.by ? this.staffOf(item.by, lookup)?.id : undefined;
    if (item.by && !salesId) unmapped.by = item.by;
    salesId ??= lead.assignedSalesId ?? (await this.fallbackAuthor(tx, lookup));

    const data = { body: item.text, kind: finalKind, callResult: callResult ?? null };
    const existing = targetId ? await tx.leadNote.findFirst({ where: { id: targetId, companyId, leadId: lead.id }, select: { id: true } }) : null;
    if (existing) {
      await tx.leadNote.updateMany({ where: { id: existing.id, companyId }, data });
      return { status: 'updated', id: existing.id, warnings: [], unmapped };
    }
    let at = item.at ? new Date(item.at) : new Date();
    if (at.getTime() > Date.now()) at = new Date();
    const note = await tx.leadNote.create({
      data: { ...data, companyId, leadId: lead.id, salesId, createdAt: at },
      select: { id: true },
    });
    return { status: 'created', id: note.id, warnings: [], unmapped };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async lookup(companyId: string): Promise<Lookup> {
    const [company, sources, unitTypes, staff] = await Promise.all([
      this.prisma.company.findUnique({ where: { id: companyId }, select: { country: true } }),
      this.prisma.leadSource.findMany({ where: { companyId, active: true }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true } }),
      this.prisma.unitType.findMany({
        where: { companyId, active: true },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        select: { code: true, name: true, usage: true },
      }),
      scopedUserFindMany(
        this.prisma,
        { role: { in: STAFF_ROLES }, active: true },
        { id: true, email: true, phone: true, role: true },
        { orderBy: { createdAt: 'asc' } },
      ),
    ]);
    const words = (name: unknown, ...more: string[]) => {
      const n = (name && typeof name === 'object' ? name : {}) as Record<string, unknown>;
      return [n.ar, n.en, ...more].filter((w): w is string => typeof w === 'string' && w.trim() !== '').map(normalizeWord);
    };
    const fallback = sources.find((s) => words(s.name).includes(normalizeWord(FALLBACK_SOURCE.en)));
    return {
      companyId,
      country: company?.country ?? 'EG',
      sources: sources.map((s) => ({ id: s.id, words: words(s.name) })),
      unitTypes: unitTypes.map((t) => ({ code: t.code, usage: t.usage, words: words(t.name, t.code) })),
      staff: staff.map((s) => ({ ...s, email: s.email?.toLowerCase() ?? null })),
      fallbackSourceId: fallback?.id,
    };
  }

  /** What a record of the same system became here, if it was sent. */
  private async targetOf(tx: Tx, run: MigrationRun, lookup: Lookup, entity: MigrationEntity, externalId: string) {
    const record = await tx.migrationRecord.findFirst({
      where: { companyId: lookup.companyId, sourceSystem: run.sourceSystem, entity, externalId },
      select: { targetId: true },
    });
    return record?.targetId;
  }

  private staffOf(value: string, lookup: Lookup) {
    const email = canonicalEmail(value);
    const byEmail = email?.includes('@') ? lookup.staff.find((s) => s.email === email) : undefined;
    if (byEmail) return byEmail;
    const phone = canonicalPhone(value) ?? canonicalPhone(value, lookup.country);
    return phone ? lookup.staff.find((s) => s.phone === phone) : undefined;
  }

  private async phone(raw: string, lookup: Lookup): Promise<string> {
    const phone = await phoneForWrite(this.prisma, raw, lookup.companyId);
    if (!phone) throw new BadRequestException('phone is required');
    return phone;
  }

  /** «نقل بيانات»: the source a lead whose own source is not the company's is filed under. */
  private async fallbackSource(tx: Tx, lookup: Lookup): Promise<string> {
    if (lookup.fallbackSourceId) return lookup.fallbackSourceId;
    lookup.pendingSourceId ??= (
      await tx.leadSource.create({
        data: { companyId: lookup.companyId, name: FALLBACK_SOURCE, active: true },
        select: { id: true },
      })
    ).id;
    return lookup.pendingSourceId;
  }

  /** The note author when the other system does not name one we know: the company's first admin. */
  private async fallbackAuthor(tx: Tx, lookup: Lookup): Promise<string> {
    const admin = lookup.staff.find((s) => s.role === UserRole.ADMIN);
    if (admin) return admin.id;
    throw new BadRequestException('The company has no active admin to file this note under');
  }

  private errorText(err: unknown): string {
    if (err instanceof HttpException) {
      const res = err.getResponse();
      const message = typeof res === 'string' ? res : (res as { message?: unknown }).message;
      return Array.isArray(message) ? message.join('; ') : String(message ?? err.message);
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const target = (err.meta?.target as string[] | string | undefined) ?? 'a field';
      return `A value is already used by another record here (${Array.isArray(target) ? target.join(', ') : target})`;
    }
    this.logger.error(`[data-migration] record failed: ${(err as Error)?.message}`, (err as Error)?.stack);
    return 'The record could not be saved';
  }

  private async assertCompany(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { id: true, slug: true } });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  private async audit(companyId: string, actorId: string, action: string, entityId: string, after: Record<string, unknown>) {
    await this.prisma.auditLog.create({
      data: { companyId, actorId, action, entityType: 'migration-run', entityId, after: after as Prisma.InputJsonValue },
    });
  }
}

const RUN_SELECT = {
  id: true,
  sourceSystem: true,
  sourceLabel: true,
  tokenPrefix: true,
  expiresAt: true,
  status: true,
  note: true,
  lastUsedAt: true,
  finishedAt: true,
  createdAt: true,
} as const;

function runState(run: { status: string; expiresAt: Date }): 'OPEN' | 'EXPIRED' | 'FINISHED' {
  if (run.status === 'FINISHED') return 'FINISHED';
  return run.expiresAt.getTime() <= Date.now() ? 'EXPIRED' : 'OPEN';
}

/** "Salesforce CRM" → "salesforce-crm"; "" for a name with no English letters. */
export function slugOf(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

/** A code from another system's id: "proj_12" → "PROJ-12"; a prefix keeps it valid. */
export function codeFrom(externalId: string, prefix: string): string {
  const code = externalId.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  if (ENTITY_CODE_PATTERN.test(code)) return code;
  return `${prefix}-${createHash('sha1').update(externalId).digest('hex').slice(0, 8).toUpperCase()}`;
}

async function assertFreeProjectCode(tx: Tx, companyId: string, code: string) {
  if (await tx.project.findFirst({ where: { companyId, code }, select: { id: true } })) {
    throw new BadRequestException(`Project code "${code}" is used by another project of the company`);
  }
}

async function freeProjectCode(tx: Tx, companyId: string, base: string): Promise<string> {
  for (let n = 1; n < 100; n++) {
    const code = n === 1 ? base : `${base.slice(0, 60)}-${n}`;
    if (!(await tx.project.findFirst({ where: { companyId, code }, select: { id: true } }))) return code;
  }
  throw new BadRequestException('No free project code — send one in "code"');
}

/** The project's phase by name; its first one when no name is sent; else a new one. */
async function findOrCreatePhase(tx: Tx, companyId: string, projectId: string, name?: string): Promise<string> {
  const phases = await tx.phase.findMany({
    where: { companyId, projectId },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, name: true, code: true },
  });
  if (!name && phases[0]) return phases[0].id;
  const label = name ?? 'المرحلة الأولى';
  const word = normalizeWord(label);
  const match = phases.find((p) => {
    const n = (p.name ?? {}) as Record<string, unknown>;
    return [n.ar, n.en, p.code].some((w) => typeof w === 'string' && normalizeWord(w) === word);
  });
  if (match) return match.id;
  const phase = await tx.phase.create({
    data: {
      companyId,
      projectId,
      name: { ar: label, en: label },
      code: nextCode('PH', phases.map((p) => p.code)),
      order: phases.length,
    },
    select: { id: true },
  });
  return phase.id;
}

/** The phase's building by name; its first one when no name is sent; else a new one. */
async function findOrCreateBuilding(tx: Tx, companyId: string, phaseId: string, name?: string, floor?: number): Promise<string> {
  const buildings = await tx.building.findMany({
    where: { companyId, phaseId },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, name: true, code: true, totalFloors: true },
  });
  if (!name && buildings[0]) return buildings[0].id;
  const label = name ?? 'مبنى ١';
  const word = normalizeWord(label);
  const match = buildings.find((b) => [b.name, b.code].some((w) => typeof w === 'string' && normalizeWord(w) === word));
  if (match) return match.id;
  const building = await tx.building.create({
    data: {
      companyId,
      phaseId,
      name: label,
      code: nextCode('B', buildings.map((b) => b.code)),
      order: buildings.length,
      totalFloors: Math.max(1, (floor ?? 0) + 1),
    },
    select: { id: true },
  });
  return building.id;
}

function nextCode(prefix: string, taken: (string | null)[]): string {
  const used = new Set(taken.filter(Boolean));
  for (let n = used.size + 1; ; n++) if (!used.has(`${prefix}${n}`)) return `${prefix}${n}`;
}

function dayOf(value: string, field: string): Date {
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) throw new BadRequestException(`${field}: not a real day`);
  if (d.getUTCFullYear() < 1900 || d.getTime() > Date.now()) throw new BadRequestException(`${field}: between 1900 and today`);
  return d;
}

/**
 * An item split into the fields of the format and everything else: any field
 * not in the format is kept as extra data, with the `extra` the sender gave.
 */
function splitItem(cls: new () => object, raw: Record<string, unknown>) {
  const props = new Set(
    getMetadataStorage()
      .getTargetValidationMetadatas(cls, '', true, false)
      .map((m) => m.propertyName),
  );
  const known: Record<string, unknown> = {};
  const extra: Record<string, string | number | boolean> = {};
  const problems: string[] = [];
  const keep = (key: string, value: unknown) => {
    if (value === null || value === undefined || value === '') return;
    if (Object.keys(extra).length >= EXTRA_MAX_KEYS) {
      problems.push(`extra: at most ${EXTRA_MAX_KEYS} fields`);
      return;
    }
    const k = key.trim().slice(0, 100);
    if (!k) return;
    extra[k] =
      typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
        ? typeof value === 'string'
          ? value.slice(0, EXTRA_MAX_VALUE)
          : value
        : JSON.stringify(value).slice(0, EXTRA_MAX_VALUE);
  };
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'extra') continue;
    if (props.has(key)) known[key] = value;
    else keep(key, value);
  }
  if (raw.extra !== undefined && raw.extra !== null) {
    if (typeof raw.extra !== 'object' || Array.isArray(raw.extra)) problems.push('extra: must be an object of field → value');
    else for (const [key, value] of Object.entries(raw.extra as Record<string, unknown>)) keep(key, value);
  }
  return { known, extra, problems: [...new Set(problems)] };
}

function messagesOf(error: { property: string; constraints?: Record<string, string>; children?: unknown[] }): string[] {
  return Object.values(error.constraints ?? {}).map((m) => (m.startsWith(error.property) ? m : `${error.property}: ${m}`));
}

function resultOf(externalId: string, handled: Handled, extra: Record<string, unknown>): MigrationItemResult {
  const kept = { extra: Object.keys(extra), unmapped: Object.keys(handled.unmapped) };
  return {
    externalId,
    status: handled.status,
    id: handled.id,
    ...(handled.warnings.length ? { warnings: handled.warnings } : {}),
    ...(kept.extra.length || kept.unmapped.length ? { kept } : {}),
  };
}
