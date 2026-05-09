import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, LeadStage } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

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
  async create(dto: CreateLeadDto) {
    const lead = await this.prisma.lead.create({
      data: {
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email ?? null,
        sourceId: dto.sourceId ?? null,
        projectInterestId: dto.projectInterestId ?? null,
        assignedSalesId: dto.assignedSalesId ?? null,
      },
    });
    if (dto.notes && dto.assignedSalesId) {
      await this.prisma.leadNote.create({
        data: { leadId: lead.id, salesId: dto.assignedSalesId, body: dto.notes },
      });
    }
    await this.prisma.leadActivity.create({
      data: { leadId: lead.id, type: 'created', payload: {} },
    });
    return lead;
  }

  async findAll(opts: {
    page?: number;
    pageSize?: number;
    stage?: LeadStage;
    salesId?: string;
    q?: string;
    assignedToMe?: string;
  }) {
    const page = opts.page ?? 1;
    const pageSize = opts.pageSize ?? 20;
    const where: Prisma.LeadWhereInput = {
      ...(opts.stage ? { stage: opts.stage } : {}),
      ...(opts.salesId ? { assignedSalesId: opts.salesId } : {}),
      ...(opts.assignedToMe ? { assignedSalesId: opts.assignedToMe } : {}),
      ...(opts.q
        ? {
            OR: [
              { fullName: { contains: opts.q, mode: 'insensitive' } },
              { phone: { contains: opts.q } },
              { email: { contains: opts.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        ...takeSkip({ page, pageSize }),
        orderBy: { createdAt: 'desc' },
        include: {
          source: true,
          assignedSales: { select: { id: true, fullName: true } },
          projectInterest: { select: { id: true, name: true } },
        },
      }),
      this.prisma.lead.count({ where }),
    ]);
    return paginate(data, total, { page, pageSize });
  }

  async findOne(id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        source: true,
        assignedSales: { select: { id: true, fullName: true } },
        projectInterest: true,
        notes: {
          orderBy: { createdAt: 'desc' },
          include: { sales: { select: { id: true, fullName: true } } },
        },
        activities: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');
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
    return updated;
  }

  async assign(id: string, dto: AssignLeadDto) {
    await this.assertExists(id);
    const updated = await this.prisma.lead.update({
      where: { id },
      data: { assignedSalesId: dto.assignedSalesId },
    });
    await this.prisma.leadActivity.create({
      data: { leadId: id, type: 'assigned', payload: { salesId: dto.assignedSalesId } },
    });
    return updated;
  }

  async addNote(leadId: string, salesId: string, dto: CreateLeadNoteDto) {
    await this.assertExists(leadId);
    return this.prisma.leadNote.create({
      data: { leadId, salesId, body: dto.body },
    });
  }

  async pipelineCounts() {
    const stages = Object.values(LeadStage);
    const result: Record<string, number> = {};
    for (const stage of stages) {
      result[stage] = await this.prisma.lead.count({ where: { stage } });
    }
    return result;
  }

  private async assertExists(id: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }
}
