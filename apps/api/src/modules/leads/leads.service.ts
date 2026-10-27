import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {
  AppointmentStatus,
  LeadFollowUpType,
  LeadNoteKind,
  Prisma,
  LeadStage,
  ReservationStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { assertAssignableSales } from '../../common/utils/assignable-sales';
import { managerScopeIds } from '../../common/utils/sales-scope';
import { resolveTenantUser } from '../../common/tenant/resolve-tenant-entity';
import { NotificationsService } from '../notifications/notifications.module';
import {
  CreateLeadDto,
  UpdateLeadDto,
  UpdateLeadStageDto,
  AssignLeadDto,
  CreateLeadNoteDto,
  CreateLeadSourceDto,
  UpdateLeadSourceDto,
  FollowUpBucket,
} from './dto/lead.dto';
import { paginate, takeSkip, toCounts } from '../../common/utils/pagination';
import { enumFilter } from '../../common/utils/query-filters';
import { getRequiredCompanyId, getTenantContext } from '../../common/tenant/tenant-context';
import { currentCompanyTimeZone, endOfLocalTodayInstant } from '../../common/time/company-timezone';
import { phoneForWrite } from '../../common/utils/phone-for-write';
import { assertClientClaimable, clientOwnerScope } from '../../common/utils/client-ownership';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

/** Stages that still need following up. */
const OPEN_STAGES: LeadStage[] = [LeadStage.NEW, LeadStage.INTERESTED, LeadStage.VISIT, LeadStage.NEGOTIATION];

/** A follow-up is due in the future; a minute of slack for the clock on the caller's device. */
const NEXT_ACTION_SLACK_MS = 60_000;

const CLEAR_NEXT_ACTION = { nextActionAt: null, nextActionType: null, nextActionNote: null } as const;

type FollowUpScope = { salesId?: string; salesIds?: string[] };

/** Row cap for the legacy leads upload (the data import caps sheets at 2000). */
const LEGACY_IMPORT_MAX_ROWS = 2000;

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ----- Sources -----
  listSources() {
    return this.prisma.leadSource.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async createSource(dto: CreateLeadSourceDto) {
    const name = { ar: dto.ar.trim(), en: dto.en.trim() };
    await this.assertSourceNameFree(name);
    return this.prisma.leadSource.create({ data: { name: name as Prisma.InputJsonValue } });
  }

  /** Rename a source or switch it off. A switched-off source stays on its leads. */
  async updateSource(id: string, dto: UpdateLeadSourceDto) {
    const source = await this.prisma.leadSource.findFirst({ where: { id } });
    if (!source) throw new NotFoundException('Lead source not found');
    const current = source.name as { ar?: string; en?: string };
    const name = {
      ar: dto.ar?.trim() ?? current.ar ?? '',
      en: dto.en?.trim() ?? current.en ?? '',
    };
    if (dto.ar !== undefined || dto.en !== undefined) await this.assertSourceNameFree(name, id);
    return this.prisma.leadSource.update({
      where: { id },
      data: {
        ...(dto.ar !== undefined || dto.en !== undefined
          ? { name: name as Prisma.InputJsonValue }
          : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
  }

  /** Two sources with one name split the reports and make the Excel import ambiguous. */
  private async assertSourceNameFree(name: { ar: string; en: string }, exceptId?: string) {
    const all = await this.prisma.leadSource.findMany({ select: { id: true, name: true } });
    const norm = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '');
    const taken = all.some((s) => {
      if (s.id === exceptId) return false;
      const n = s.name as { ar?: string; en?: string };
      return norm(n.ar) === norm(name.ar) || norm(n.en) === norm(name.en);
    });
    if (taken) throw new ConflictException('يوجد مصدر بنفس الاسم');
  }

  /** A lead's source must be one of the company's active sources. */
  private async assertUsableSource(sourceId: string | null | undefined) {
    if (!sourceId) return;
    const source = await this.prisma.leadSource.findFirst({
      where: { id: sourceId },
      select: { active: true },
    });
    if (!source) throw new BadRequestException('Lead source not found');
    if (!source.active) throw new BadRequestException('هذا المصدر موقوف — اختر مصدراً آخر');
  }

  // ----- Leads -----
  /**
   * Create a CRM lead linked to a Client (User).
   *
   * Resolution order for the client:
   *   1. `clientId` provided → use it (must exist).
   *   2. Otherwise, look up an existing User by phone.
   *   3. Otherwise, look up an existing User by email.
   *   4. Otherwise, create a new User with role=CLIENT using the supplied
   *      fullName/phone/email.
   *
   * Wrapped in a single transaction so a partially-created client is rolled
   * back if the lead insert fails. We catch unique-violation on phone/email to
   * cover the rare race where another request creates the same client between
   * the lookup and the insert.
   */
  async create(dto: CreateLeadDto, actor?: AuthUser) {
    // Client ownership (common/utils/client-ownership.ts). A rep's lead is
    // theirs: SALES may only assign themselves, a manager themselves or their
    // team; left empty it defaults to the creator, so the new lead is never
    // invisible to the rep who made it.
    const scope = actor ? await clientOwnerScope(this.prisma, actor) : null;
    let assignedSalesId = dto.assignedSalesId ?? null;
    if (actor && scope !== null) {
      assignedSalesId ??= actor.sub;
      if (!scope.includes(assignedSalesId)) {
        throw new ForbiddenException('You can only assign a lead to yourself or your team');
      }
    }
    // An admin may pick anyone — but only an active sales person.
    if (assignedSalesId && assignedSalesId !== actor?.sub) {
      await assertAssignableSales(this.prisma, assignedSalesId);
    }

    await this.assertUsableSource(dto.sourceId);

    const lead = await this.prisma.$transaction(async (tx) => {
      const client = await this.resolveClient(tx, dto);
      // An existing client belongs to whoever owns it; a rep cannot take it
      // over by creating a lead for its phone number (admin reassigns).
      if (!client.created) await assertClientClaimable(tx, scope, client.id);

      const created = await tx.lead.create({
        data: {
          clientId: client.id,
          fullName: client.fullName,
          phone: client.phone ?? dto.phone ?? '',
          email: client.email ?? dto.email ?? null,
          sourceId: dto.sourceId ?? null,
          projectInterestId: dto.projectInterestId ?? null,
          unitInterestId: dto.unitInterestId ?? null,
          assignedSalesId,
        },
      });

      if (dto.notes && assignedSalesId) {
        await tx.leadNote.create({
          data: { leadId: created.id, salesId: assignedSalesId, body: dto.notes },
        });
      }

      await tx.leadActivity.create({
        data: { leadId: created.id, type: 'created', payload: {} },
      });

      return created;
    });

    // Notify ADMIN + SALES_MANAGER that a new lead was created.
    const projectName = dto.projectInterestId
      ? await this.resolveProjectName(dto.projectInterestId)
      : '';
    const notifPayload = {
      entityType: 'lead',
      entityId: lead.id,
      customerName: lead.fullName,
      projectName,
    };
    // Never the user who created it (a rep's own lead is assigned to them).
    const except = { except: actor?.sub };
    await this.notifications.sendToRoles(
      [UserRole.ADMIN, UserRole.SALES_MANAGER],
      'lead_created',
      notifPayload,
      except,
    );
    // If already assigned on creation, notify the sales rep.
    if (lead.assignedSalesId) {
      await this.notifications.sendToUser(lead.assignedSalesId, 'lead_assigned_sales', notifPayload, except);
    }

    return lead;
  }

  /**
   * Resolve (or create) the Client a Lead must point to. Always runs inside
   * the caller's transaction so duplicates can never be committed.
   */
  private async resolveClient(
    tx: Prisma.TransactionClient,
    dto: CreateLeadDto,
  ): Promise<{
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
    /** True when this call created the client (it had no owner to check). */
    created: boolean;
  }> {
    if (dto.clientId) {
      const found = await resolveTenantUser(
        tx,
        dto.clientId,
        { id: true, fullName: true, phone: true, email: true },
      );
      return { ...found, created: false };
    }

    // FG-21 — normalise before both the lookup and the create, so `01…` finds
    // and reuses a client already stored as `+201…` instead of splitting them.
    // Option B — email and phone are unique per company, so every lookup below
    // is scoped: the same person can be a client of two developers, as two
    // separate accounts, each holding only that developer's records.
    const companyId = getTenantContext()?.companyId ?? null;
    const phone = (await phoneForWrite(tx, dto.phone, companyId)) ?? null;
    const email = dto.email?.trim() || null;
    const fullName = dto.fullName?.trim() || '';

    if (!phone && !email) {
      throw new BadRequestException(
        'A lead must reference a client: provide clientId, or phone/email to find-or-create one.',
      );
    }
    if (!fullName && !phone && !email) {
      throw new BadRequestException('Lead requires fullName when creating a new client.');
    }

    if (phone) {
      const byPhone = await tx.user.findFirst({
        where: { phone, companyId },
        select: { id: true, fullName: true, phone: true, email: true },
      });
      if (byPhone) return { ...byPhone, created: false };
    }
    if (email) {
      const byEmail = await tx.user.findFirst({
        where: { email, companyId },
        select: { id: true, fullName: true, phone: true, email: true },
      });
      if (byEmail) return { ...byEmail, created: false };
    }

    if (!fullName) {
      throw new BadRequestException('fullName is required to create a new client');
    }

    try {
      const createdClient = await tx.user.create({
        data: {
          role: 'CLIENT',
          fullName,
          phone,
          email,
          locale: 'ar',
          companyId,
        },
        select: { id: true, fullName: true, phone: true, email: true },
      });
      return { ...createdClient, created: true };
    } catch (e) {
      // Race: another request inserted the same phone/email between our
      // lookup and create. Re-fetch and use that record.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const target = phone
          ? await tx.user.findFirst({
              where: { phone, companyId },
              select: { id: true, fullName: true, phone: true, email: true },
            })
          : email
            ? await tx.user.findFirst({
                where: { email, companyId },
                select: { id: true, fullName: true, phone: true, email: true },
              })
            : null;
        if (target) return { ...target, created: false };
      }
      throw e;
    }
  }

  async findAll(opts: {
    page?: number;
    pageSize?: number;
    stage?: LeadStage | LeadStage[];
    salesId?: string;
    salesIds?: string[];
    q?: string;
    assignedToMe?: string;
    clientId?: string;
    sourceId?: string;
    dateFrom?: string;
    dateTo?: string;
    /** Exact instant, exclusive. Day-granular `dateTo` cannot express "older than 72 hours". */
    createdBefore?: Date;
    /** Only leads nobody owns yet. */
    unassigned?: boolean;
  }) {
    const page = opts.page ?? 1;
    const pageSize = opts.pageSize ?? 20;
    const stageFilter = enumFilter(
      opts.stage === undefined ? undefined : Array.isArray(opts.stage) ? opts.stage : [opts.stage],
    );
    const where: Prisma.LeadWhereInput = {
      ...(stageFilter ? { stage: stageFilter } : {}),
      ...(opts.salesIds
        ? { assignedSalesId: { in: opts.salesIds } }
        : opts.salesId
          ? { assignedSalesId: opts.salesId }
          : {}),
      ...(opts.assignedToMe ? { assignedSalesId: opts.assignedToMe } : {}),
      ...(opts.unassigned ? { assignedSalesId: null } : {}),
      ...(opts.clientId ? { clientId: opts.clientId } : {}),
      ...(opts.sourceId ? { sourceId: opts.sourceId } : {}),
      ...(opts.dateFrom || opts.dateTo || opts.createdBefore
        ? {
            createdAt: {
              ...(opts.dateFrom ? { gte: new Date(opts.dateFrom) } : {}),
              ...(opts.dateTo ? { lte: new Date(opts.dateTo + 'T23:59:59.999Z') } : {}),
              ...(opts.createdBefore ? { lt: opts.createdBefore } : {}),
            },
          }
        : {}),
      ...(opts.q
        ? {
            OR: [
              { fullName: { contains: opts.q, mode: 'insensitive' } },
              { phone: { contains: opts.q } },
              { email: { contains: opts.q, mode: 'insensitive' } },
              {
                client: {
                  OR: [
                    { fullName: { contains: opts.q, mode: 'insensitive' } },
                    { phone: { contains: opts.q } },
                    { email: { contains: opts.q, mode: 'insensitive' } },
                  ],
                },
              },
            ],
          }
        : {}),
    };
    const [raw, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        ...takeSkip({ page, pageSize }),
        orderBy: { createdAt: 'desc' },
        include: {
          client: {
            select: { id: true, fullName: true, phone: true, email: true, role: true, passwordHash: true, createdAt: true },
          },
          source: true,
          assignedSales: { select: { id: true, fullName: true } },
          projectInterest: { select: { id: true, name: true } },
          unitInterest: { select: { id: true, code: true, type: true } },
          // Broker attribution — present only for broker-origin leads
          // (brokerId != null). Null for direct leads, so behavior is unchanged.
          broker: {
            select: { id: true, companyName: true, commercialName: true, code: true },
          },
          brokerAgent: { select: { id: true, fullName: true } },
          appointments: {
            where: {
              status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
              scheduledAt: { gte: new Date() },
            },
            orderBy: { scheduledAt: 'asc' },
            take: 1,
            select: { id: true, visitNumber: true, scheduledAt: true, status: true },
          },
          // "Last contact" on the kanban card: the latest note logged on the lead.
          notes: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
        },
      }),
      this.prisma.lead.count({ where }),
    ]);

    const data = raw.map(({ appointments, notes, ...lead }) => {
      const c = lead.client;
      return {
        ...lead,
        client: c
          ? {
              ...c,
              hasAccount:
                !!c.passwordHash ||
                (c.createdAt != null && new Date(c.createdAt).getTime() < new Date(lead.createdAt).getTime() - 5_000),
              passwordHash: undefined,
              createdAt: undefined,
            }
          : c,
        upcomingVisit: appointments[0] ?? null,
        lastContactAt: notes?.[0]?.createdAt ?? null,
      };
    });
    // FG-23 — the sales and manager home dashboards counted won/lost stages
    // client-side from ?pageSize=100, so a rep with more than a hundred leads
    // saw wrong numbers. Computed over the same `where`, so a self-scoped
    // query (my-compensation) gets self-scoped counts for free.
    const stageGroups = await this.prisma.lead.groupBy({
      by: ['stage'],
      where,
      _count: true,
    });
    const facets = {
      counts: {
        stage: toCounts(stageGroups.map((g) => [String(g.stage), g._count] as const)),
      },
    };

    return paginate(data, total, { page, pageSize }, facets);
  }

  async findOne(id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            role: true,
            locale: true,
            active: true,
            createdAt: true,
            passwordHash: true,
          },
        },
        source: true,
        assignedSales: { select: { id: true, fullName: true } },
        projectInterest: true,
        // Broker attribution for the lead detail "مصدر الفرصة" section.
        broker: {
          select: { id: true, companyName: true, commercialName: true, code: true },
        },
        brokerAgent: { select: { id: true, fullName: true } },
        // The timeline: activities newest first, each with its replies in order.
        notes: {
          where: { parentId: null },
          orderBy: { createdAt: 'desc' },
          include: {
            sales: { select: { id: true, fullName: true } },
            replies: {
              orderBy: { createdAt: 'asc' },
              include: { sales: { select: { id: true, fullName: true } } },
            },
          },
        },
        activities: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    if (lead.client) {
      // An account is a password set on the client (CLAUDE.md: never infer
      // it from how much older the client row is than the lead).
      const { passwordHash, createdAt: _clientCreatedAt, ...clientRest } = lead.client;
      const hasAccount = !!passwordHash;
      return { ...lead, client: { ...clientRest, hasAccount } };
    }
    return lead;
  }

  async update(id: string, dto: UpdateLeadDto, actorId?: string) {
    const lead = await this.assertExists(id);
    if (dto.sourceId !== undefined && dto.sourceId !== lead.sourceId) {
      await this.assertUsableSource(dto.sourceId);
    }
    const data: Prisma.LeadUncheckedUpdateInput = { ...dto };
    if (dto.phone !== undefined) {
      // Stored E.164, like on create — duplicate and OTP lookups match on it.
      const phone = await phoneForWrite(this.prisma, dto.phone, getTenantContext()?.companyId ?? null);
      if (!phone) throw new BadRequestException('رقم الهاتف غير صالح');
      data.phone = phone;
    }
    const updated = await this.prisma.lead.update({ where: { id }, data });
    // The lead's sales person hears that someone else edited it.
    await this.notifications.sendToUser(
      lead.assignedSalesId,
      'lead_updated',
      { entityType: 'lead', entityId: id, customerName: updated.fullName },
      { except: actorId },
    );
    return updated;
  }

  async updateStage(id: string, dto: UpdateLeadStageDto, actorId?: string) {
    const lead = await this.assertExists(id);
    if (lead.stage === dto.stage) return lead;
    // WON is what a converted reservation sets — by hand it marks a sale that
    // never happened (and then blocks the real reservation).
    if (dto.stage === LeadStage.WON) {
      throw new BadRequestException('تتحول حالة العميل إلى "تم البيع" تلقائياً عند تحويل الحجز إلى عقد');
    }
    // A lead with a deal in progress is not lost — and one that was won stays won.
    if (lead.stage === LeadStage.WON) {
      throw new BadRequestException('تم البيع لهذا العميل — لا يمكن تغيير حالته');
    }
    if (dto.stage === LeadStage.LOST) {
      const live = await this.prisma.reservation.count({
        where: { leadId: id, status: { in: [ReservationStatus.PENDING, ReservationStatus.APPROVED] } },
      });
      if (live > 0) throw new BadRequestException('للعميل حجز قائم — ألغِ الحجز أولاً قبل اعتباره مفقوداً');
    }
    const updated = await this.prisma.lead.update({
      where: { id },
      // A lost lead has nothing left to follow up.
      data: { stage: dto.stage, ...(dto.stage === LeadStage.LOST ? CLEAR_NEXT_ACTION : {}) },
    });
    await this.prisma.leadActivity.create({
      data: {
        leadId: id,
        type: 'status_change',
        payload: { from: lead.stage, to: dto.stage, reason: dto.reason ?? null },
      },
    });
    // Notify assigned sales rep and managers about the stage change.
    const stagePayload = {
      entityType: 'lead',
      entityId: id,
      customerName: lead.fullName,
      fromStage: lead.stage,
      toStage: dto.stage,
    };
    // The sales person, the sales managers and — for a broker's lead — the
    // agent who brought it and the firm's managers; never whoever moved it.
    const except = { except: actorId };
    const broker = await this.notifications.brokerRecipients(lead.brokerId, { agentUserId: lead.brokerAgentId });
    await this.notifications.sendToUsers([lead.assignedSalesId, ...broker], 'lead_stage_changed', stagePayload, except);
    await this.notifications.sendToRoles([UserRole.SALES_MANAGER], 'lead_stage_changed', stagePayload, except);
    return updated;
  }

  async assign(id: string, dto: AssignLeadDto, actor?: AuthUser) {
    const actorId = actor?.sub;
    const lead = await this.assertExists(id);
    if (actor?.role === UserRole.SALES_MANAGER) {
      // A manager routes their unassigned queue and their own team's leads,
      // to themselves or someone on their team.
      const team = await managerScopeIds(this.prisma, actor.sub);
      if (lead.assignedSalesId && !team.includes(lead.assignedSalesId)) {
        throw new ForbiddenException('Record is outside your team');
      }
      if (!team.includes(dto.assignedSalesId)) {
        throw new ForbiddenException('You can only assign a lead to yourself or your team');
      }
    }
    if (dto.assignedSalesId) await assertAssignableSales(this.prisma, dto.assignedSalesId);
    const updated = await this.prisma.lead.update({
      where: { id },
      data: { assignedSalesId: dto.assignedSalesId },
    });
    // The lead's upcoming visits go with it: the old rep would be reminded of
    // them and the new one could not see them.
    const upcoming = { leadId: id, status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING_RESCHEDULE] }, scheduledAt: { gte: new Date() } };
    await this.prisma.visitAppointment.updateMany({ where: upcoming, data: { assignedSalesId: dto.assignedSalesId } });
    await this.prisma.leadActivity.create({
      data: { leadId: id, type: 'assigned', payload: { salesId: dto.assignedSalesId } },
    });
    // The newly assigned sales rep — and the previous one, who lost it.
    const payload = { entityType: 'lead', entityId: id, customerName: lead.fullName, projectName: '' };
    if (dto.assignedSalesId) {
      await this.notifications.sendToUser(dto.assignedSalesId, 'lead_assigned_sales', payload, { except: actorId });
    }
    if (lead.assignedSalesId && lead.assignedSalesId !== dto.assignedSalesId) {
      await this.notifications.sendToUser(lead.assignedSalesId, 'lead_unassigned', payload, { except: actorId });
    }
    return updated;
  }

  /**
   * Logs an activity on a lead — a note, a call and how it went, a meeting, a
   * WhatsApp chat — or a reply to one, and sets the lead's next follow-up.
   */
  async addNote(leadId: string, salesId: string, dto: CreateLeadNoteDto) {
    const companyId = getRequiredCompanyId();
    const lead = await this.assertExists(leadId);
    const kind = dto.kind ?? LeadNoteKind.NOTE;
    const body = dto.body.trim();
    if (!body) throw new BadRequestException('اكتب نص الملاحظة');

    let parent: { id: string; salesId: string; parentId: string | null } | null = null;
    if (dto.parentId) {
      parent = await this.prisma.leadNote.findFirst({
        where: { id: dto.parentId, leadId, companyId },
        select: { id: true, salesId: true, parentId: true },
      });
      if (!parent) throw new NotFoundException('Note not found');
      if (parent.parentId) throw new BadRequestException('لا يمكن الرد على رد — رد على الملاحظة الأصلية');
      if (dto.kind || dto.callResult || dto.nextActionAt !== undefined) {
        throw new BadRequestException('الرد نص فقط — بدون نوع أو نتيجة مكالمة أو متابعة');
      }
    }
    if (dto.callResult && kind !== LeadNoteKind.CALL) {
      throw new BadRequestException('نتيجة المكالمة تُسجَّل مع المكالمات فقط');
    }

    // undefined keeps the lead's follow-up, null clears it, a date sets it.
    let nextAction: Prisma.LeadUncheckedUpdateInput | null = null;
    if (dto.nextActionAt === null) {
      nextAction = { ...CLEAR_NEXT_ACTION };
    } else if (dto.nextActionAt !== undefined) {
      const at = new Date(dto.nextActionAt);
      if (at.getTime() < Date.now() - NEXT_ACTION_SLACK_MS) {
        throw new BadRequestException('موعد المتابعة القادمة يجب أن يكون في المستقبل');
      }
      if (!OPEN_STAGES.includes(lead.stage)) {
        throw new BadRequestException('لا متابعة على عميل تم البيع له أو مفقود');
      }
      nextAction = {
        nextActionAt: at,
        nextActionType: dto.nextActionType ?? LeadFollowUpType.FOLLOW_UP,
        nextActionNote: dto.nextActionNote?.trim() || null,
      };
    }

    const scheduled = nextAction?.nextActionAt instanceof Date ? nextAction : null;
    const note = await this.prisma.$transaction(async (tx) => {
      const created = await tx.leadNote.create({
        data: {
          leadId,
          salesId,
          body,
          kind: parent ? LeadNoteKind.NOTE : kind,
          callResult: kind === LeadNoteKind.CALL ? (dto.callResult ?? null) : null,
          parentId: parent?.id ?? null,
          nextActionAt: scheduled ? (scheduled.nextActionAt as Date) : null,
          nextActionType: scheduled ? (scheduled.nextActionType as LeadFollowUpType) : null,
        },
      });
      if (nextAction) {
        await tx.lead.updateMany({ where: { id: leadId, companyId }, data: nextAction });
      }
      return created;
    });

    const payload = { entityType: 'lead', entityId: leadId, customerName: lead.fullName };
    // The lead's sales rep, and whoever wrote the note being replied to —
    // never the author themselves.
    await this.notifications.sendToUsers(
      [lead.assignedSalesId, parent?.salesId ?? null],
      'lead_note_added',
      payload,
      { except: salesId },
    );
    return note;
  }

  /**
   * The follow-up lists: leads whose next action is past due, due later
   * today (the company's day), or after today. Open leads only.
   */
  private async followUpWindows() {
    const companyId = getRequiredCompanyId();
    const now = new Date();
    const zone = await currentCompanyTimeZone(this.prisma, companyId);
    const endOfToday = endOfLocalTodayInstant(zone, now);
    const windows: Record<FollowUpBucket, Prisma.DateTimeNullableFilter> = {
      overdue: { lt: now },
      today: { gte: now, lt: endOfToday },
      upcoming: { gte: endOfToday },
    };
    return { companyId, windows };
  }

  private followUpWhere(companyId: string, scope: FollowUpScope, at: Prisma.DateTimeNullableFilter): Prisma.LeadWhereInput {
    return {
      companyId,
      stage: { in: OPEN_STAGES },
      nextActionAt: at,
      ...(scope.salesIds
        ? { assignedSalesId: { in: scope.salesIds } }
        : scope.salesId
          ? { assignedSalesId: scope.salesId }
          : {}),
    };
  }

  async followUpSummary(scope: FollowUpScope) {
    const { companyId, windows } = await this.followUpWindows();
    const [overdue, today, upcoming] = await this.prisma.$transaction([
      this.prisma.lead.count({ where: this.followUpWhere(companyId, scope, windows.overdue) }),
      this.prisma.lead.count({ where: this.followUpWhere(companyId, scope, windows.today) }),
      this.prisma.lead.count({ where: this.followUpWhere(companyId, scope, windows.upcoming) }),
    ]);
    return { overdue, today, upcoming };
  }

  async followUps(scope: FollowUpScope, bucket: FollowUpBucket, opts: { page?: number; pageSize?: number } = {}) {
    const page = opts.page ?? 1;
    const pageSize = Math.min(opts.pageSize ?? 20, 100);
    const { companyId, windows } = await this.followUpWindows();
    const where = this.followUpWhere(companyId, scope, windows[bucket]);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        ...takeSkip({ page, pageSize }),
        // Overdue: the longest-waiting first; otherwise the soonest first.
        orderBy: { nextActionAt: 'asc' },
        select: {
          id: true,
          fullName: true,
          phone: true,
          stage: true,
          nextActionAt: true,
          nextActionType: true,
          nextActionNote: true,
          client: { select: { id: true, fullName: true, phone: true } },
          assignedSales: { select: { id: true, fullName: true } },
          projectInterest: { select: { id: true, name: true } },
          notes: {
            where: { parentId: null },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { kind: true, callResult: true, body: true, createdAt: true },
          },
        },
      }),
      this.prisma.lead.count({ where }),
    ]);
    const data = rows.map(({ notes, ...lead }) => ({ ...lead, lastActivity: notes[0] ?? null }));
    return paginate(data, total, { page, pageSize });
  }

  async pipelineCounts(opts: { salesId?: string; salesIds?: string[] } = {}) {
    const scopeWhere: Prisma.LeadWhereInput = opts.salesIds
      ? { assignedSalesId: { in: opts.salesIds } }
      : opts.salesId
        ? { assignedSalesId: opts.salesId }
        : {};

    const stages = Object.values(LeadStage);
    const result: Record<string, number> = {};
    for (const stage of stages) {
      result[stage] = await this.prisma.lead.count({ where: { stage, ...scopeWhere } });
    }
    return result;
  }

  private async assertExists(id: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  private async resolveProjectName(projectId: string): Promise<string> {
    try {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true },
      });
      const name = project?.name as { ar?: string; en?: string } | null;
      return name?.ar ?? name?.en ?? '';
    } catch {
      return '';
    }
  }

  // ── Excel Import ──────────────────────────────────────────────────────────

  /** Parse an Excel buffer into validated row previews (no DB side effects). */
  async previewImport(buffer: Buffer): Promise<ImportPreviewResult> {
    const rows = await this.parseExcelBuffer(buffer);
    return { rows };
  }

  /**
   * Import leads from an Excel buffer.
   * - Skips rows where a lead with the same phone already exists.
   * - Returns counts and per-row errors for the caller to surface.
   */
  async importLeads(buffer: Buffer, sourceId?: string, actor?: AuthUser): Promise<ImportResult> {
    const actorId = actor?.sub;
    await this.assertUsableSource(sourceId);
    const rows = await this.parseExcelBuffer(buffer);
    if (rows.length > LEGACY_IMPORT_MAX_ROWS) {
      throw new BadRequestException(`الملف يتجاوز الحد الأقصى (${LEGACY_IMPORT_MAX_ROWS} صف)`);
    }
    const valid = rows.filter((r) => r.valid && r.phone);
    const invalid = rows.filter((r) => !r.valid || !r.phone);

    // Compare in the stored (E.164) form: the file's 010… numbers never
    // matched, so re-uploading a file duplicated every lead.
    const companyId = getTenantContext()?.companyId ?? null;
    const canonical = new Map<string, string>();
    for (const r of valid) {
      canonical.set(r.phone!, (await phoneForWrite(this.prisma, r.phone!, companyId)) ?? r.phone!);
    }
    const existingLeads = await this.prisma.lead.findMany({
      where: { phone: { in: [...new Set(canonical.values())] } },
      select: { phone: true },
    });
    const existingPhones = new Set(existingLeads.map((l) => l.phone));

    let imported = 0;
    let skipped = 0;
    const errors: Array<{ row: number; message: string }> = invalid.map((r) => ({
      row: r.rowNumber,
      message: r.error ?? 'بيانات غير مكتملة',
    }));

    for (const row of valid) {
      const phone = canonical.get(row.phone!)!;
      if (existingPhones.has(phone)) {
        skipped++;
        continue;
      }
      try {
        // As the importing user — the same ownership rules as creating the
        // lead by hand (a manager can't attach leads to another team's
        // clients); left unassigned it goes to the importer, so notes are kept.
        await this.create(
          {
            fullName: row.name!,
            phone: row.phone!,
            email: row.email ?? undefined,
            sourceId: sourceId ?? undefined,
            notes: row.notes ?? undefined,
          },
          actor,
        );
        existingPhones.add(phone);
        imported++;
      } catch (e) {
        errors.push({ row: row.rowNumber, message: (e as Error).message ?? 'خطأ غير متوقع' });
      }
    }

    if (imported > 0) {
      await this.notifications.sendToRoles(
        [UserRole.ADMIN, UserRole.SALES_MANAGER],
        'leads_imported',
        { count: String(imported), skipped: String(skipped) },
        { except: actorId },
      );
    }
    return { imported, skipped, errors, total: rows.length };
  }

  private async parseExcelBuffer(buffer: Buffer): Promise<ImportRow[]> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException('الملف فارغ أو لا يحتوي على أوراق عمل');

    const rows: ImportRow[] = [];
    const HEADER_ROW = 1;

    // Detect column indices from header row (case-insensitive Arabic/English)
    const headerRow = ws.getRow(HEADER_ROW);
    const colMap: { name: number; phone: number; email: number; notes: number } = {
      name: 1, phone: 2, email: 3, notes: 4,
    };
    headerRow.eachCell((cell, colNum) => {
      const v = String(cell.value ?? '').trim().toLowerCase();
      if (['name', 'اسم', 'الاسم', 'full name', 'الاسم الكامل'].includes(v)) colMap.name = colNum;
      if (['phone', 'هاتف', 'الهاتف', 'mobile', 'جوال'].includes(v)) colMap.phone = colNum;
      if (['email', 'بريد', 'البريد', 'البريد الإلكتروني', 'e-mail'].includes(v)) colMap.email = colNum;
      if (['notes', 'note', 'ملاحظات', 'ملاحظة'].includes(v)) colMap.notes = colNum;
    });

    ws.eachRow((row, rowNum) => {
      if (rowNum === HEADER_ROW) return;

      const name = String(row.getCell(colMap.name).value ?? '').trim();
      const phone = String(row.getCell(colMap.phone).value ?? '').trim().replace(/\s+/g, '');
      const email = String(row.getCell(colMap.email).value ?? '').trim() || undefined;
      const notes = String(row.getCell(colMap.notes).value ?? '').trim() || undefined;

      if (!name && !phone) return; // blank row

      const errors: string[] = [];
      if (!name) errors.push('الاسم مطلوب');
      if (!phone) errors.push('الهاتف مطلوب');
      if (email && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) errors.push('البريد الإلكتروني غير صحيح');

      rows.push({
        rowNumber: rowNum,
        name: name || undefined,
        phone: phone || undefined,
        email,
        notes,
        valid: errors.length === 0,
        error: errors.join(' — ') || undefined,
      });
    });

    if (rows.length === 0) throw new BadRequestException('لم يتم العثور على بيانات في الملف');
    return rows;
  }
}

export interface ImportRow {
  rowNumber: number;
  name?: string;
  phone?: string;
  email?: string;
  notes?: string;
  valid: boolean;
  error?: string;
}

export interface ImportPreviewResult {
  rows: ImportRow[];
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
  total: number;
}
