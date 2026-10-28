import { BadRequestException, Injectable } from '@nestjs/common';
import { AppointmentStatus, ContractStatus, LeadNoteKind, LeadStage, Prisma, ReservationStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getRequiredCompanyId } from '../../common/tenant/tenant-context';
import { currentCompanyTimeZone, localDayStartInstant } from '../../common/time/company-timezone';

const OPEN_STAGES: LeadStage[] = [LeadStage.NEW, LeadStage.INTERESTED, LeadStage.VISIT, LeadStage.NEGOTIATION];
const DAY_MS = 24 * 60 * 60 * 1000;
/** A month view with its spill-over weeks fits; anything wider is refused. */
const MAX_DAYS = 45;

/** Whose events: everyone's (admin), a set (a manager's team), one rep. */
export interface CalendarScope {
  salesId?: string;
  salesIds?: string[];
}

export type CalendarEvent =
  | {
      type: 'visit';
      id: string;
      at: Date;
      leadId: string | null;
      customer: string | null;
      project: unknown;
      sales: { id: string; fullName: string } | null;
      status: AppointmentStatus;
      ref: string;
    }
  | {
      type: 'follow_up';
      id: string;
      at: Date;
      leadId: string;
      customer: string;
      project: unknown;
      sales: { id: string; fullName: string } | null;
      kind: string;
      note: string | null;
    }
  | {
      type: 'reservation_expiry';
      id: string;
      at: Date;
      leadId: string | null;
      customer: string | null;
      unit: string | null;
      project: unknown;
      sales: { id: string; fullName: string } | null;
      status: ReservationStatus;
      ref: string | null;
    }
  | {
      type: 'contract_signed';
      id: string;
      at: Date;
      customer: string | null;
      unit: string | null;
      project: unknown;
      sales: { id: string; fullName: string } | null;
      ref: string | null;
    }
  | {
      type: 'done';
      id: string;
      at: Date;
      leadId: string;
      customer: string;
      sales: { id: string; fullName: string } | null;
      kind: LeadNoteKind;
      callResult: string | null;
    };

/**
 * CAL1 — a rep's (or a team's) diary between two company days: visits
 * booked, follow-ups due (each open lead's next action), the calls,
 * meetings and chats already logged, reservations running out (and those
 * that did), and contracts signed. A reservation or contract belongs to the
 * reservation's rep.
 */
@Injectable()
export class LeadCalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async events(scope: CalendarScope, from: string, to: string): Promise<{ from: string; to: string; timeZone: string; events: CalendarEvent[] }> {
    const companyId = getRequiredCompanyId();
    const zone = await currentCompanyTimeZone(this.prisma, companyId);
    const start = localDayStartInstant(zone, from);
    const end = new Date(localDayStartInstant(zone, to).getTime() + DAY_MS);
    if (end <= start) throw new BadRequestException('`to` must not be before `from`');
    if (end.getTime() - start.getTime() > MAX_DAYS * DAY_MS) throw new BadRequestException(`At most ${MAX_DAYS} days at a time`);
    const range = { gte: start, lt: end };
    const owner = (field: string): Record<string, unknown> =>
      scope.salesIds ? { [field]: { in: scope.salesIds } } : scope.salesId ? { [field]: scope.salesId } : {};

    const unitSelect = { code: true, building: { select: { phase: { select: { project: { select: { name: true } } } } } } } as const;
    const [visits, followUps, done, reservations, contracts] = await Promise.all([
      this.prisma.visitAppointment.findMany({
        where: { companyId, scheduledAt: range, ...(owner('assignedSalesId') as Prisma.VisitAppointmentWhereInput) },
        orderBy: { scheduledAt: 'asc' },
        take: 500,
        select: {
          id: true,
          visitNumber: true,
          scheduledAt: true,
          status: true,
          leadId: true,
          client: { select: { fullName: true } },
          lead: { select: { fullName: true } },
          project: { select: { name: true } },
          assignedSales: { select: { id: true, fullName: true } },
        },
      }),
      this.prisma.lead.findMany({
        where: { companyId, stage: { in: OPEN_STAGES }, nextActionAt: range, ...(owner('assignedSalesId') as Prisma.LeadWhereInput) },
        orderBy: { nextActionAt: 'asc' },
        take: 500,
        select: {
          id: true,
          fullName: true,
          nextActionAt: true,
          nextActionType: true,
          nextActionNote: true,
          projectInterest: { select: { name: true } },
          assignedSales: { select: { id: true, fullName: true } },
        },
      }),
      this.prisma.leadNote.findMany({
        where: {
          companyId,
          createdAt: range,
          parentId: null,
          kind: { in: [LeadNoteKind.CALL, LeadNoteKind.MEETING, LeadNoteKind.WHATSAPP] },
          ...(owner('salesId') as Prisma.LeadNoteWhereInput),
        },
        orderBy: { createdAt: 'asc' },
        take: 500,
        select: {
          id: true,
          createdAt: true,
          kind: true,
          callResult: true,
          leadId: true,
          lead: { select: { fullName: true } },
          sales: { select: { id: true, fullName: true } },
        },
      }),
      this.prisma.reservation.findMany({
        where: {
          companyId,
          deletedAt: null,
          expiresAt: range,
          status: { in: [ReservationStatus.PENDING, ReservationStatus.APPROVED, ReservationStatus.EXPIRED] },
          ...(owner('salesId') as Prisma.ReservationWhereInput),
        },
        orderBy: { expiresAt: 'asc' },
        take: 500,
        select: {
          id: true,
          reservationNumber: true,
          expiresAt: true,
          status: true,
          leadId: true,
          client: { select: { fullName: true } },
          lead: { select: { fullName: true } },
          unit: { select: unitSelect },
          sales: { select: { id: true, fullName: true } },
        },
      }),
      this.prisma.contract.findMany({
        where: {
          companyId,
          deletedAt: null,
          status: { not: ContractStatus.CANCELLED },
          signedAt: range,
          ...(scope.salesIds || scope.salesId ? { reservation: owner('salesId') as Prisma.ReservationWhereInput } : {}),
        },
        orderBy: { signedAt: 'asc' },
        take: 500,
        select: {
          id: true,
          contractNumber: true,
          signedAt: true,
          customer: { select: { fullName: true } },
          unit: { select: unitSelect },
          reservation: { select: { sales: { select: { id: true, fullName: true } } } },
        },
      }),
    ]);

    const events: CalendarEvent[] = [
      ...visits.map((v) => ({
        type: 'visit' as const,
        id: v.id,
        at: v.scheduledAt,
        leadId: v.leadId,
        customer: v.client?.fullName ?? v.lead?.fullName ?? null,
        project: v.project?.name ?? null,
        sales: v.assignedSales,
        status: v.status,
        ref: v.visitNumber,
      })),
      ...followUps.map((l) => ({
        type: 'follow_up' as const,
        id: l.id,
        at: l.nextActionAt!,
        leadId: l.id,
        customer: l.fullName,
        project: l.projectInterest?.name ?? null,
        sales: l.assignedSales,
        kind: l.nextActionType ?? 'FOLLOW_UP',
        note: l.nextActionNote,
      })),
      ...reservations.map((r) => ({
        type: 'reservation_expiry' as const,
        id: r.id,
        at: r.expiresAt,
        leadId: r.leadId,
        customer: r.client?.fullName ?? r.lead?.fullName ?? null,
        unit: r.unit.code,
        project: r.unit.building?.phase?.project?.name ?? null,
        sales: r.sales,
        status: r.status,
        ref: r.reservationNumber,
      })),
      ...contracts.map((c) => ({
        type: 'contract_signed' as const,
        id: c.id,
        at: c.signedAt!,
        customer: c.customer?.fullName ?? null,
        unit: c.unit.code,
        project: c.unit.building?.phase?.project?.name ?? null,
        sales: c.reservation?.sales ?? null,
        ref: c.contractNumber,
      })),
      ...done.map((n) => ({
        type: 'done' as const,
        id: n.id,
        at: n.createdAt,
        leadId: n.leadId,
        customer: n.lead.fullName,
        sales: n.sales,
        kind: n.kind,
        callResult: n.callResult,
      })),
    ].sort((a, b) => a.at.getTime() - b.at.getTime());

    return { from, to, timeZone: zone, events };
  }
}
