import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LeadStage, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getRequiredCompanyId } from '../../common/tenant/tenant-context';
import { staffName } from '../../common/utils/sales-scope';

const OPEN_STAGES: LeadStage[] = [LeadStage.NEW, LeadStage.INTERESTED, LeadStage.VISIT, LeadStage.NEGOTIATION];
/** How far along a stage is: the merged lead keeps the furthest. */
const STAGE_RANK: Record<LeadStage, number> = { NEW: 0, INTERESTED: 1, VISIT: 2, NEGOTIATION: 3, WON: 4, LOST: -1 };

/** The leads a caller may see: everyone's (admin), a team's plus the unassigned queue (manager). */
export interface DuplicateScope {
  salesIds?: string[];
}

const LEAD_SELECT = {
  id: true,
  fullName: true,
  phone: true,
  stage: true,
  createdAt: true,
  clientId: true,
  assignedSalesId: true,
  brokerId: true,
  nextActionAt: true,
  assignedSales: { select: { id: true, fullName: true } },
  source: { select: { id: true, name: true } },
  campaign: { select: { id: true, name: true, channel: true } },
  projectInterest: { select: { id: true, name: true } },
  broker: { select: { id: true, companyName: true, commercialName: true, code: true } },
  _count: { select: { notes: true, reservations: true } },
} satisfies Prisma.LeadSelect;

/**
 * DUP1 — the same customer with more than one open lead (two reps added
 * them by hand, a broker submitted one the website already had…). A
 * customer is one client row per company, so duplicates are open leads that
 * share a client. The admin, or a sales manager over their own team, keeps
 * one and merges the others into it.
 */
@Injectable()
export class LeadDuplicatesService {
  constructor(private readonly prisma: PrismaService) {}

  private inScope(scope: DuplicateScope, salesId: string | null): boolean {
    return !scope.salesIds || salesId === null || scope.salesIds.includes(salesId);
  }

  async list(scope: DuplicateScope) {
    const companyId = getRequiredCompanyId();
    const groups = await this.prisma.lead.groupBy({
      by: ['clientId'],
      where: { companyId, stage: { in: OPEN_STAGES } },
      _count: true,
      having: { clientId: { _count: { gt: 1 } } },
    });
    if (!groups.length) return { groups: [], total: 0 };
    const leads = await this.prisma.lead.findMany({
      where: { companyId, stage: { in: OPEN_STAGES }, clientId: { in: groups.map((g) => g.clientId) } },
      orderBy: [{ createdAt: 'asc' }],
      select: { ...LEAD_SELECT, client: { select: { id: true, fullName: true, phone: true, email: true } } },
    });
    const byClient = new Map<string, typeof leads>();
    for (const l of leads) byClient.set(l.clientId, [...(byClient.get(l.clientId) ?? []), l]);
    const out = [...byClient.values()]
      // A manager sees a customer only when every lead on it is theirs to touch.
      .filter((ls) => ls.length > 1 && ls.every((l) => this.inScope(scope, l.assignedSalesId)))
      .map((ls) => ({
        client: ls[0]!.client,
        leads: ls.map(({ client: _client, ...l }) => ({ ...l, mergeable: l._count.reservations === 0 && !l.brokerId })),
      }))
      .sort((a, b) => b.leads.length - a.leads.length);
    return { groups: out, total: out.length };
  }

  /**
   * Keep `keepId` and fold `duplicateIds` into it: their notes, activity,
   * inquiries, visit requests, appointments and chats move over, the kept
   * lead fills its blanks from them (campaign — the first one, source,
   * project, unit, UTM, owner, next follow-up) and takes the furthest stage;
   * then they are removed. A lead with a reservation or a broker's credit is
   * never merged away — keep that one instead.
   */
  async merge(keepId: string, duplicateIds: string[], scope: DuplicateScope, actorId: string) {
    const companyId = getRequiredCompanyId();
    const ids = [...new Set(duplicateIds)].filter((id) => id !== keepId);
    if (!ids.length) throw new BadRequestException('Choose the leads to merge');
    const all = await this.prisma.lead.findMany({
      where: { companyId, id: { in: [keepId, ...ids] } },
      orderBy: [{ createdAt: 'asc' }],
      select: {
        ...LEAD_SELECT,
        sourceId: true,
        campaignId: true,
        projectInterestId: true,
        unitInterestId: true,
        utmSource: true,
        utmMedium: true,
        utmCampaign: true,
        utmContent: true,
        nextActionType: true,
        nextActionNote: true,
      },
    });
    const keep = all.find((l) => l.id === keepId);
    if (!keep || all.length !== ids.length + 1) throw new NotFoundException('Lead not found');
    const dups = all.filter((l) => l.id !== keepId);
    if (all.some((l) => l.clientId !== keep.clientId)) throw new BadRequestException('Only one customer’s leads can be merged');
    if (all.some((l) => !OPEN_STAGES.includes(l.stage))) throw new BadRequestException('Only open leads can be merged');
    if (all.some((l) => !this.inScope(scope, l.assignedSalesId))) throw new BadRequestException('A lead is not in your team');
    const blocked = dups.find((l) => l._count.reservations > 0 || l.brokerId);
    if (blocked) {
      throw new BadRequestException('A lead with a reservation or a broker cannot be merged away — keep that one instead');
    }

    // The kept lead's blanks, from the others in the order they came in.
    const first = <K extends keyof (typeof all)[number]>(k: K) => keep[k] ?? dups.find((d) => d[k] != null)?.[k] ?? null;
    const furthest = all.reduce((s, l) => (STAGE_RANK[l.stage] > STAGE_RANK[s] ? l.stage : s), keep.stage);
    const now = Date.now();
    const nextFrom = keep.nextActionAt ? keep : dups.filter((d) => d.nextActionAt && d.nextActionAt.getTime() > now).sort((a, b) => a.nextActionAt!.getTime() - b.nextActionAt!.getTime())[0];
    const moved = { leadId: keepId };
    const where = { companyId, leadId: { in: ids } };
    const by = await staffName(this.prisma, actorId);

    await this.prisma.$transaction(async (tx) => {
      await tx.leadNote.updateMany({ where, data: moved });
      await tx.leadActivity.updateMany({ where, data: moved });
      await tx.infoRequest.updateMany({ where, data: moved });
      await tx.visitRequest.updateMany({ where, data: moved });
      await tx.visitAppointment.updateMany({ where, data: moved });
      await tx.visitActivity.updateMany({ where, data: moved });
      await tx.chatSession.updateMany({ where, data: moved });
      await tx.lead.updateMany({
        where: { id: keepId, companyId },
        data: {
          stage: furthest,
          sourceId: first('sourceId'),
          campaignId: first('campaignId'),
          projectInterestId: first('projectInterestId'),
          unitInterestId: first('unitInterestId'),
          assignedSalesId: first('assignedSalesId'),
          utmSource: first('utmSource'),
          utmMedium: first('utmMedium'),
          utmCampaign: first('utmCampaign'),
          utmContent: first('utmContent'),
          ...(nextFrom && nextFrom !== keep
            ? { nextActionAt: nextFrom.nextActionAt, nextActionType: nextFrom.nextActionType, nextActionNote: nextFrom.nextActionNote }
            : {}),
        },
      });
      await tx.lead.deleteMany({ where: { companyId, id: { in: ids } } });
      await tx.leadActivity.create({
        data: {
          leadId: keepId,
          companyId,
          type: 'merged',
          payload: { count: ids.length, mergedIds: ids, byId: actorId, by },
        },
      });
    });
    return { id: keepId, merged: ids.length };
  }
}
