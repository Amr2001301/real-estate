import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus, Prisma, LeadStage, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.module';
import {
  CreateLeadDto,
  UpdateLeadDto,
  UpdateLeadStageDto,
  AssignLeadDto,
  CreateLeadNoteDto,
  CreateLeadSourceDto,
} from './dto/lead.dto';
import { paginate, takeSkip } from '../../common/utils/pagination';

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ----- Sources -----
  listSources() {
    return this.prisma.leadSource.findMany({ orderBy: { createdAt: 'desc' } });
  }

  createSource(dto: CreateLeadSourceDto) {
    return this.prisma.leadSource.create({
      data: { name: { ar: dto.ar, en: dto.en } as Prisma.InputJsonValue },
    });
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
  async create(dto: CreateLeadDto) {
    const lead = await this.prisma.$transaction(async (tx) => {
      const client = await this.resolveClient(tx, dto);

      const created = await tx.lead.create({
        data: {
          clientId: client.id,
          fullName: client.fullName,
          phone: client.phone ?? dto.phone ?? '',
          email: client.email ?? dto.email ?? null,
          sourceId: dto.sourceId ?? null,
          projectInterestId: dto.projectInterestId ?? null,
          unitInterestId: dto.unitInterestId ?? null,
          assignedSalesId: dto.assignedSalesId ?? null,
        },
      });

      if (dto.notes && dto.assignedSalesId) {
        await tx.leadNote.create({
          data: { leadId: created.id, salesId: dto.assignedSalesId, body: dto.notes },
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
    await this.notifications.sendToRoles(
      [UserRole.ADMIN, UserRole.SALES_MANAGER],
      'lead_created',
      notifPayload,
    );
    // If already assigned on creation, notify the sales rep.
    if (lead.assignedSalesId) {
      await this.notifications.sendToUser(lead.assignedSalesId, 'lead_assigned_sales', notifPayload);
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
  ): Promise<{ id: string; fullName: string; phone: string | null; email: string | null }> {
    if (dto.clientId) {
      const found = await tx.user.findUnique({
        where: { id: dto.clientId },
        select: { id: true, fullName: true, phone: true, email: true },
      });
      if (!found) throw new NotFoundException('Client not found');
      return found;
    }

    const phone = dto.phone?.trim() || null;
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
      const byPhone = await tx.user.findUnique({
        where: { phone },
        select: { id: true, fullName: true, phone: true, email: true },
      });
      if (byPhone) return byPhone;
    }
    if (email) {
      const byEmail = await tx.user.findUnique({
        where: { email },
        select: { id: true, fullName: true, phone: true, email: true },
      });
      if (byEmail) return byEmail;
    }

    if (!fullName) {
      throw new BadRequestException('fullName is required to create a new client');
    }

    try {
      return await tx.user.create({
        data: {
          role: 'CLIENT',
          fullName,
          phone,
          email,
          locale: 'ar',
        },
        select: { id: true, fullName: true, phone: true, email: true },
      });
    } catch (e) {
      // Race: another request inserted the same phone/email between our
      // lookup and create. Re-fetch and use that record.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const target = phone
          ? await tx.user.findUnique({
              where: { phone },
              select: { id: true, fullName: true, phone: true, email: true },
            })
          : email
            ? await tx.user.findUnique({
                where: { email },
                select: { id: true, fullName: true, phone: true, email: true },
              })
            : null;
        if (target) return target;
      }
      throw e;
    }
  }

  async findAll(opts: {
    page?: number;
    pageSize?: number;
    stage?: LeadStage;
    salesId?: string;
    salesIds?: string[];
    q?: string;
    assignedToMe?: string;
    clientId?: string;
  }) {
    const page = opts.page ?? 1;
    const pageSize = opts.pageSize ?? 20;
    const where: Prisma.LeadWhereInput = {
      ...(opts.stage ? { stage: opts.stage } : {}),
      ...(opts.salesIds
        ? { assignedSalesId: { in: opts.salesIds } }
        : opts.salesId
          ? { assignedSalesId: opts.salesId }
          : {}),
      ...(opts.assignedToMe ? { assignedSalesId: opts.assignedToMe } : {}),
      ...(opts.clientId ? { clientId: opts.clientId } : {}),
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
        },
      }),
      this.prisma.lead.count({ where }),
    ]);

    const data = raw.map(({ appointments, ...lead }) => {
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
      };
    });
    return paginate(data, total, { page, pageSize });
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
        notes: {
          orderBy: { createdAt: 'desc' },
          include: { sales: { select: { id: true, fullName: true } } },
        },
        activities: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    if (lead.client) {
      const { passwordHash, createdAt: clientCreatedAt, ...clientRest } = lead.client;
      const hasAccount =
        !!passwordHash ||
        (clientCreatedAt != null &&
          new Date(clientCreatedAt).getTime() < new Date(lead.createdAt).getTime() - 5_000);
      return { ...lead, client: { ...clientRest, hasAccount } };
    }
    return lead;
  }

  async update(id: string, dto: UpdateLeadDto) {
    await this.assertExists(id);
    return this.prisma.lead.update({ where: { id }, data: { ...dto } });
  }

  async updateStage(id: string, dto: UpdateLeadStageDto) {
    const lead = await this.assertExists(id);
    if (lead.stage === dto.stage) return lead;
    const updated = await this.prisma.lead.update({
      where: { id },
      data: { stage: dto.stage },
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
    const recipients = [lead.assignedSalesId].filter((v): v is string => !!v);
    await this.notifications.sendToUsers(recipients, 'lead_stage_changed', stagePayload);
    await this.notifications.sendToRoles([UserRole.SALES_MANAGER], 'lead_stage_changed', stagePayload);
    return updated;
  }

  async assign(id: string, dto: AssignLeadDto) {
    const lead = await this.assertExists(id);
    const updated = await this.prisma.lead.update({
      where: { id },
      data: { assignedSalesId: dto.assignedSalesId },
    });
    await this.prisma.leadActivity.create({
      data: { leadId: id, type: 'assigned', payload: { salesId: dto.assignedSalesId } },
    });
    // Notify the newly assigned sales rep.
    if (dto.assignedSalesId) {
      await this.notifications.sendToUser(dto.assignedSalesId, 'lead_assigned_sales', {
        entityType: 'lead',
        entityId: id,
        customerName: lead.fullName,
        projectName: '',
      });
    }
    return updated;
  }

  async addNote(leadId: string, salesId: string, dto: CreateLeadNoteDto) {
    const lead = await this.assertExists(leadId);
    const note = await this.prisma.leadNote.create({
      data: { leadId, salesId, body: dto.body },
    });
    // Notify the assigned sales rep (if different from the note author).
    if (lead.assignedSalesId && lead.assignedSalesId !== salesId) {
      await this.notifications.sendToUser(lead.assignedSalesId, 'lead_note_added', {
        entityType: 'lead',
        entityId: leadId,
        customerName: lead.fullName,
      });
    }
    return note;
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
}
