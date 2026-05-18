import { Injectable } from '@nestjs/common';
import { BrokerActivityType, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { paginate } from '../../common/utils/pagination';
import type { BrokerScopeContext } from '../../common/guards/broker-scope.guard';
import {
  PortalActivityQueryDto,
  PortalActivityType,
} from './dto/portal-activity.dto';

type RawType = string;
type EntityType =
  | 'Lead'
  | 'VisitRequest'
  | 'Reservation'
  | 'Contract'
  | 'Commission'
  | 'Payout';

// LeadActivity.type → portal type/entity. Adding a new event here is a
// one-line change.
const LEAD_TYPE_MAP: Record<RawType, { portal: PortalActivityType; entity: EntityType }> = {
  broker_submitted: { portal: 'LEAD_SUBMITTED', entity: 'Lead' },
  broker_submitted_via_visit: { portal: 'LEAD_SUBMITTED', entity: 'Lead' },
  broker_visit_requested: { portal: 'VISIT_REQUESTED', entity: 'VisitRequest' },
  broker_approved: { portal: 'LEAD_APPROVED', entity: 'Lead' },
  broker_rejected: { portal: 'LEAD_REJECTED', entity: 'Lead' },
  broker_marked_duplicate: { portal: 'LEAD_MARKED_DUPLICATE', entity: 'Lead' },
  broker_reservation_created: { portal: 'RESERVATION_CREATED', entity: 'Reservation' },
  broker_contract_created: { portal: 'CONTRACT_CREATED', entity: 'Contract' },
  broker_contract_signed: { portal: 'CONTRACT_SIGNED', entity: 'Contract' },
  broker_commission_earned: { portal: 'COMMISSION_EARNED', entity: 'Commission' },
  broker_commission_approved: { portal: 'COMMISSION_APPROVED', entity: 'Commission' },
  broker_commission_rejected: { portal: 'COMMISSION_REJECTED', entity: 'Commission' },
  broker_commission_cancelled: { portal: 'COMMISSION_CANCELLED', entity: 'Commission' },
};

// BrokerActivityLog.type (the typed enum) → portal type/entity.
const BROKER_ACTIVITY_TYPE_MAP: Record<BrokerActivityType, { portal: PortalActivityType; entity: EntityType }> = {
  PAYOUT_CREATED: { portal: 'PAYOUT_CREATED', entity: 'Payout' },
  PAYOUT_APPROVED: { portal: 'PAYOUT_APPROVED', entity: 'Payout' },
  PAYOUT_PROCESSING: { portal: 'PAYOUT_PROCESSING', entity: 'Payout' },
  PAYOUT_PAID: { portal: 'PAYOUT_PAID', entity: 'Payout' },
  PAYOUT_CANCELLED: { portal: 'PAYOUT_CANCELLED', entity: 'Payout' },
};

export interface ActivityRow {
  id: string;
  type: PortalActivityType;
  rawType: string;
  entityType: EntityType;
  entityId: string;
  payload: Record<string, unknown>;
  createdAt: Date;
  lead: {
    id: string;
    fullName: string;
    phone: string;
    brokerApprovalStatus: unknown;
    stage: unknown;
    projectInterest: { id: string; name: unknown; city: string } | null;
    unitInterest: { id: string; code: string; type: string } | null;
  } | null;
}

@Injectable()
export class BrokerPortalActivityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Merged activity feed: LeadActivity rows (lead/visit/reservation/contract/
   * commission events) UNION BrokerActivityLog rows (payout events).
   *
   * Both sources are queried independently, normalised to the same shape,
   * concatenated, sorted by createdAt desc, then paginated in memory. The
   * portal's activity volume is bounded enough for this to be fine; if it
   * grows large we can move to a materialised view without touching callers.
   */
  async list(scope: BrokerScopeContext, query: PortalActivityQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 30;

    // Filter routing: when the user picks a type or entityType, only one of
    // the two sources may contribute. Reduces query cost in the common case.
    const wantsLeadSource = this.sourceForFilter(query) !== 'broker-only';
    const wantsBrokerSource = this.sourceForFilter(query) !== 'lead-only';

    // Over-fetch (page * pageSize) from each source, merge, slice. Cheap
    // enough at portal scale; correctness > optimality here.
    const limit = page * pageSize;

    const [leadActivities, leadCount, brokerActivities, brokerCount] =
      await Promise.all([
        wantsLeadSource ? this.queryLeadActivities(scope, query, limit) : Promise.resolve([]),
        wantsLeadSource ? this.countLeadActivities(scope, query) : Promise.resolve(0),
        wantsBrokerSource ? this.queryBrokerActivities(scope, query, limit) : Promise.resolve([]),
        wantsBrokerSource ? this.countBrokerActivities(scope, query) : Promise.resolve(0),
      ]);

    const merged = [...leadActivities, ...brokerActivities].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
    const start = (page - 1) * pageSize;
    const slice = merged.slice(start, start + pageSize);

    return paginate(slice, leadCount + brokerCount, { page, pageSize });
  }

  // Routing decision: 'lead-only' / 'broker-only' / 'both'.
  private sourceForFilter(
    query: PortalActivityQueryDto,
  ): 'lead-only' | 'broker-only' | 'both' {
    if (query.entityType === 'Payout') return 'broker-only';
    if (query.entityType) return 'lead-only';
    if (query.type) {
      const isPayout = query.type.startsWith('PAYOUT_');
      return isPayout ? 'broker-only' : 'lead-only';
    }
    return 'both';
  }

  // ── LeadActivity branch ────────────────────────────────────────────────

  private leadWhere(
    scope: BrokerScopeContext,
    query: PortalActivityQueryDto,
  ): Prisma.LeadActivityWhereInput {
    let rawTypes = Object.keys(LEAD_TYPE_MAP);
    if (query.type) {
      rawTypes = rawTypes.filter((t) => LEAD_TYPE_MAP[t]!.portal === query.type);
    }
    // sourceForFilter() already routes 'Payout' entityType to the broker source
    // so reaching this code with entityType === 'Payout' is unreachable in
    // practice — but Prisma's enum-narrowing makes the comparison noisy, so
    // we accept the entityType as a string here.
    if (query.entityType && (query.entityType as string) !== 'Payout') {
      const e = query.entityType;
      rawTypes = rawTypes.filter((t) => LEAD_TYPE_MAP[t]!.entity === e);
    }
    if (rawTypes.length === 0) {
      // No matching raw types — short-circuit by filtering on a never-matching id.
      return { id: '__none__' };
    }
    return {
      type: { in: rawTypes },
      lead: { brokerId: scope.brokerId },
    };
  }

  private async queryLeadActivities(
    scope: BrokerScopeContext,
    query: PortalActivityQueryDto,
    limit: number,
  ): Promise<ActivityRow[]> {
    const rows = await this.prisma.leadActivity.findMany({
      where: this.leadWhere(scope, query),
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        lead: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            brokerApprovalStatus: true,
            stage: true,
            projectInterest: { select: { id: true, name: true, city: true } },
            unitInterest: { select: { id: true, code: true, type: true } },
          },
        },
      },
    });
    return rows.map((r) => {
      const mapped = LEAD_TYPE_MAP[r.type] ?? {
        portal: 'LEAD_SUBMITTED' as PortalActivityType,
        entity: 'Lead' as EntityType,
      };
      const payload = (r.payload as Record<string, unknown> | null) ?? {};
      let entityId: string = r.leadId;
      if (mapped.entity === 'VisitRequest' && typeof payload.visitRequestId === 'string') {
        entityId = payload.visitRequestId;
      } else if (mapped.entity === 'Reservation' && typeof payload.reservationId === 'string') {
        entityId = payload.reservationId;
      } else if (mapped.entity === 'Contract' && typeof payload.contractId === 'string') {
        entityId = payload.contractId;
      } else if (mapped.entity === 'Commission' && typeof payload.commissionId === 'string') {
        entityId = payload.commissionId;
      }
      return {
        id: r.id,
        type: mapped.portal,
        rawType: r.type,
        entityType: mapped.entity,
        entityId,
        payload,
        createdAt: r.createdAt,
        lead: r.lead,
      };
    });
  }

  private countLeadActivities(
    scope: BrokerScopeContext,
    query: PortalActivityQueryDto,
  ): Promise<number> {
    return this.prisma.leadActivity.count({ where: this.leadWhere(scope, query) });
  }

  // ── BrokerActivityLog branch ───────────────────────────────────────────

  private brokerWhere(
    scope: BrokerScopeContext,
    query: PortalActivityQueryDto,
  ): Prisma.BrokerActivityLogWhereInput {
    const allTypes = Object.keys(BROKER_ACTIVITY_TYPE_MAP) as BrokerActivityType[];
    let types: BrokerActivityType[] = allTypes;
    if (query.type) {
      types = types.filter(
        (t) => BROKER_ACTIVITY_TYPE_MAP[t].portal === query.type,
      );
    }
    if (query.entityType && query.entityType !== 'Payout') {
      // BrokerActivityLog currently only carries Payout events.
      types = [];
    }
    if (types.length === 0) {
      return { id: '__none__' };
    }
    return {
      brokerId: scope.brokerId,
      type: { in: types },
    };
  }

  private async queryBrokerActivities(
    scope: BrokerScopeContext,
    query: PortalActivityQueryDto,
    limit: number,
  ): Promise<ActivityRow[]> {
    const rows = await this.prisma.brokerActivityLog.findMany({
      where: this.brokerWhere(scope, query),
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => {
      const mapped = BROKER_ACTIVITY_TYPE_MAP[r.type];
      const payload = (r.payload as Record<string, unknown> | null) ?? {};
      return {
        id: r.id,
        type: mapped.portal,
        rawType: r.type,
        entityType: mapped.entity,
        entityId: r.entityId ?? '',
        payload,
        createdAt: r.createdAt,
        lead: null,
      };
    });
  }

  private countBrokerActivities(
    scope: BrokerScopeContext,
    query: PortalActivityQueryDto,
  ): Promise<number> {
    return this.prisma.brokerActivityLog.count({ where: this.brokerWhere(scope, query) });
  }
}
