import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { LeadStage, ListingStatus, Prisma } from '@prisma/client';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { clientOwnerScope } from '../../common/utils/client-ownership';
import { reportFailure } from '../../common/observability/report-failure';
import { NotificationsService } from '../notifications/notifications.module';
import {
  matchListing,
  MIN_MATCH_SCORE,
  type MatchListing,
  type MatchRequirement,
} from './listing-matching';
import { SetRequirementDto } from './dto/listing.dto';

const OPEN_STAGES: LeadStage[] = [
  LeadStage.NEW,
  LeadStage.INTERESTED,
  LeadStage.VISIT,
  LeadStage.NEGOTIATION,
];
const MATCHABLE: ListingStatus[] = [ListingStatus.AVAILABLE, ListingStatus.UNDER_OFFER];
const LISTING_FIELDS = {
  id: true,
  code: true,
  title: true,
  kind: true,
  status: true,
  price: true,
  city: true,
  district: true,
  compound: true,
  unitType: true,
  bedrooms: true,
  area: true,
  photos: true,
} satisfies Prisma.ListingSelect;

const num = (d: Prisma.Decimal | null | undefined) =>
  d === null || d === undefined ? null : Number(d);

function toRequirement(r: {
  kinds: MatchRequirement['kinds'];
  budgetMin: Prisma.Decimal | null;
  budgetMax: Prisma.Decimal | null;
  cities: string[];
  unitTypes: string[];
  bedroomsMin: number | null;
  areaMin: number | null;
}): MatchRequirement {
  return {
    kinds: r.kinds,
    budgetMin: num(r.budgetMin),
    budgetMax: num(r.budgetMax),
    cities: r.cities,
    unitTypes: r.unitTypes,
    bedroomsMin: r.bedroomsMin,
    areaMin: r.areaMin,
  };
}

function toListing(l: {
  kind: MatchListing['kind'];
  price: Prisma.Decimal;
  city: string;
  district: string | null;
  compound: string | null;
  unitType: string;
  bedrooms: number | null;
  area: number;
}): MatchListing {
  return {
    kind: l.kind,
    price: Number(l.price),
    city: l.city,
    district: l.district,
    compound: l.compound,
    unitType: l.unitType,
    bedrooms: l.bedrooms,
    area: l.area,
  };
}

/**
 * BRK-5 — what a brokerage lead is looking for, and the listings that fit
 * it (and, from a listing, the leads it fits). A rep works only their own
 * leads, a manager their team's; the admin all.
 */
@Injectable()
export class ListingMatchingService {
  private readonly logger = new Logger(ListingMatchingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** The lead, if the caller may work it; 404 otherwise (existence is not leaked). */
  private async lead(user: AuthUser, leadId: string) {
    const scope = await clientOwnerScope(this.prisma, user);
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, ...(scope === null ? {} : { assignedSalesId: { in: scope } }) },
      select: { id: true, fullName: true, assignedSalesId: true, requirement: true },
    });
    if (!lead) throw new NotFoundException('العميل غير موجود');
    return lead;
  }

  async getRequirement(user: AuthUser, leadId: string) {
    return (await this.lead(user, leadId)).requirement;
  }

  async setRequirement(user: AuthUser, leadId: string, dto: SetRequirementDto) {
    await this.lead(user, leadId);
    if (
      dto.budgetMin !== undefined &&
      dto.budgetMax !== undefined &&
      dto.budgetMin !== null &&
      dto.budgetMax !== null &&
      dto.budgetMin > dto.budgetMax
    ) {
      throw new BadRequestException('أقل ميزانية أكبر من أعلاها');
    }
    const data = {
      kinds: dto.kinds ?? [],
      budgetMin: dto.budgetMin ?? null,
      budgetMax: dto.budgetMax ?? null,
      cities: (dto.cities ?? []).map((c) => c.trim()).filter(Boolean),
      unitTypes: dto.unitTypes ?? [],
      bedroomsMin: dto.bedroomsMin ?? null,
      areaMin: dto.areaMin ?? null,
      notes: dto.notes?.trim() || null,
    };
    const existing = await this.prisma.leadRequirement.findFirst({
      where: { leadId },
      select: { id: true },
    });
    if (existing)
      await this.prisma.leadRequirement.updateMany({ where: { id: existing.id }, data });
    else await this.prisma.leadRequirement.create({ data: { ...data, leadId } });
    return this.prisma.leadRequirement.findFirst({ where: { leadId } });
  }

  /** The listings that fit the lead, best first. */
  async matchesForLead(user: AuthUser, leadId: string) {
    const lead = await this.lead(user, leadId);
    if (!lead.requirement) return { requirement: null, matches: [] };
    const req = toRequirement(lead.requirement);
    const rows = await this.prisma.listing.findMany({
      where: {
        status: { in: MATCHABLE },
        ...(req.kinds.length ? { kind: { in: req.kinds } } : {}),
      },
      select: { ...LISTING_FIELDS, agent: { select: { id: true, fullName: true } } },
      take: 1000,
    });
    const matches = rows
      .map((l) => ({ listing: l, match: matchListing(toListing(l), req) }))
      .filter(
        (x): x is typeof x & { match: NonNullable<typeof x.match> } =>
          !!x.match && x.match.score >= MIN_MATCH_SCORE,
      )
      .sort(
        (a, b) =>
          b.match.score - a.match.score || Number(a.listing.price) - Number(b.listing.price),
      )
      .slice(0, 30)
      .map((x) => ({ ...x.listing, score: x.match.score, reasons: x.match.reasons }));
    return { requirement: lead.requirement, matches };
  }

  /** The caller's open leads this listing fits, best first. */
  async leadsForListing(user: AuthUser, listingId: string) {
    const listing = await this.prisma.listing.findFirst({
      where: { id: listingId },
      select: LISTING_FIELDS,
    });
    if (!listing) throw new NotFoundException('الوحدة غير موجودة');
    const scope = await clientOwnerScope(this.prisma, user);
    const candidates = await this.openLeadsWithRequirements(scope === null ? undefined : scope);
    return candidates
      .map((l) => ({
        lead: l,
        match: matchListing(toListing(listing), toRequirement(l.requirement!)),
      }))
      .filter(
        (x): x is typeof x & { match: NonNullable<typeof x.match> } =>
          !!x.match && x.match.score >= MIN_MATCH_SCORE,
      )
      .sort((a, b) => b.match.score - a.match.score)
      .slice(0, 30)
      .map((x) => ({
        id: x.lead.id,
        fullName: x.lead.fullName,
        phone: x.lead.phone,
        stage: x.lead.stage,
        assignedSales: x.lead.assignedSales,
        score: x.match.score,
        reasons: x.match.reasons,
      }));
  }

  private openLeadsWithRequirements(salesIds?: string[]) {
    return this.prisma.lead.findMany({
      where: {
        stage: { in: OPEN_STAGES },
        requirement: { isNot: null },
        ...(salesIds ? { assignedSalesId: { in: salesIds } } : {}),
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        stage: true,
        assignedSalesId: true,
        assignedSales: { select: { id: true, fullName: true } },
        requirement: true,
      },
      take: 2000,
    });
  }

  /**
   * A listing just went on the market: tell each rep how many of their open
   * leads it fits (one notice per rep). Never fails the save.
   */
  async announceListing(listingId: string) {
    try {
      const listing = await this.prisma.listing.findFirst({
        where: { id: listingId },
        select: LISTING_FIELDS,
      });
      if (!listing || !MATCHABLE.includes(listing.status)) return;
      const perRep = new Map<string, number>();
      for (const l of await this.openLeadsWithRequirements()) {
        if (!l.assignedSalesId) continue;
        const m = matchListing(toListing(listing), toRequirement(l.requirement!));
        if (m && m.score >= MIN_MATCH_SCORE)
          perRep.set(l.assignedSalesId, (perRep.get(l.assignedSalesId) ?? 0) + 1);
      }
      for (const [userId, count] of perRep) {
        await this.notifications.sendToUsers([userId], 'listing_matches_leads', {
          entityType: 'listing',
          entityId: listing.id,
          listingCode: listing.code,
          title: listing.title,
          count,
        });
      }
    } catch (err) {
      reportFailure(
        this.logger,
        'listing-matching',
        `New-listing notice for ${listingId} failed`,
        err,
      );
    }
  }
}
