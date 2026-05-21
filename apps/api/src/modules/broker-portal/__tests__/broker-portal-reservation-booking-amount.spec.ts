import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BrokerPortalReservationsService } from '../broker-portal-reservations.service';
import type { PrismaService } from '../../../common/prisma/prisma.service';
import type { ReservationsService } from '../../reservations/reservations.module';

/**
 * Booking-amount resolution for broker reservations. The reservation MUST
 * carry a booking amount derived from an admin-controlled active installment
 * plan — never zero, never client-supplied. createForActor:
 *   - auto-selects the single applicable active plan
 *   - requires a choice when several apply
 *   - blocks when none apply
 *   - blocks when the resolved plan's reservation amount is <= 0
 */

const BROKER_ID = 'b1111111-1111-4111-8111-111111111111';
const LEAD_ID = 'a2222222-2222-4222-8222-222222222222';
const UNIT_ID = 'c3333333-3333-4333-8333-333333333333';
const PLAN_ID = 'd4444444-4444-4444-8444-444444444444';
const PROJECT_ID = 'e5555555-5555-4555-8555-555555555555';

function decimal(n: number) {
  return new Prisma.Decimal(n);
}

interface Fixture {
  plans: Array<{ id: string; unitId: string | null; reservationAmount: Prisma.Decimal }>;
}

function makeService(fixture: Fixture) {
  // Captures the data passed to reservation.create so tests can assert on the
  // persisted bookingAmount.
  const createdReservation: { data?: Record<string, unknown> } = {};

  const txClient = {
    reservation: {
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        createdReservation.data = data;
        return { id: 'res-new', reservationNumber: 'RSV-0001', ...data };
      }),
    },
    unit: { update: jest.fn().mockResolvedValue({}) },
    unitStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    reservationActivity: { create: jest.fn().mockResolvedValue({}) },
    leadActivity: { create: jest.fn().mockResolvedValue({}) },
    lead: { update: jest.fn().mockResolvedValue({}) },
  };

  const prisma = {
    lead: {
      findFirst: jest.fn().mockResolvedValue({
        id: LEAD_ID,
        clientId: 'client-1',
        fullName: 'Ahmed Alaa',
        phone: '+966500000000',
        brokerApprovalStatus: 'APPROVED',
        assignedSalesId: 'sales-1',
        stage: 'INTERESTED',
        client: { id: 'client-1', active: true, role: 'CLIENT' },
      }),
    },
    unit: {
      findUnique: jest.fn().mockResolvedValue({
        id: UNIT_ID,
        code: 'B-107',
        status: 'AVAILABLE',
        price: decimal(500000),
        building: { phase: { projectId: PROJECT_ID } },
      }),
    },
    reservation: { findFirst: jest.fn().mockResolvedValue(null) },
    installmentPlanTemplate: {
      findMany: jest.fn().mockImplementation(async () =>
        fixture.plans.map((p) => ({
          id: p.id,
          name: `خطة ${p.id.slice(0, 4)}`,
          unitId: p.unitId,
          reservationAmount: p.reservationAmount,
          downPaymentAmount: decimal(50000),
          durationOptions: [],
        })),
      ),
    },
    brokerProjectAccess: {
      findFirst: jest.fn().mockResolvedValue({ id: 'pa-1', commissionPct: decimal(2) }),
    },
    brokerUnitAccess: { findFirst: jest.fn().mockResolvedValue(null) },
    broker: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ defaultCommissionPct: decimal(2), commissionModel: 'PERCENT_OF_SALE' }),
    },
    brokerUser: { findMany: jest.fn().mockResolvedValue([]) },
    notification: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    $transaction: jest.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(txClient)),
  };

  const reservations = {
    // Mirrors the real validateBookingPlan: returns the matching plan row.
    validateBookingPlan: jest.fn().mockImplementation(async (planId: string) => {
      const p = fixture.plans.find((x) => x.id === planId);
      return {
        id: planId,
        status: 'ACTIVE',
        projectId: PROJECT_ID,
        unitId: p?.unitId ?? null,
        netPrice: decimal(500000),
        reservationAmount: p?.reservationAmount ?? decimal(0),
        downPaymentAmount: decimal(50000),
        finalPaymentAmount: null,
        durationOptions: [],
      };
    }),
    nextReservationNumber: jest.fn().mockResolvedValue('RSV-0001'),
  };

  const svc = new BrokerPortalReservationsService(
    prisma as unknown as PrismaService,
    reservations as unknown as ReservationsService,
  );
  return { svc, prisma, reservations, createdReservation };
}

const baseInput = {
  brokerId: BROKER_ID,
  brokerAgentUserId: null,
  actorUserId: 'actor-1',
  origin: 'BROKER_PORTAL' as const,
  dto: { leadId: LEAD_ID, unitId: UNIT_ID },
};

describe('BrokerPortalReservationsService · booking amount resolution', () => {
  it('auto-selects the single applicable active plan and persists its reservationAmount', async () => {
    const { svc, createdReservation, reservations } = makeService({
      plans: [{ id: PLAN_ID, unitId: UNIT_ID, reservationAmount: decimal(25000) }],
    });

    await svc.createForActor(baseInput);

    expect(reservations.validateBookingPlan).toHaveBeenCalledWith(
      PLAN_ID,
      UNIT_ID,
      PROJECT_ID,
    );
    expect(createdReservation.data?.installmentPlanTemplateId).toBe(PLAN_ID);
    const amount = createdReservation.data?.bookingAmount as Prisma.Decimal;
    expect(amount.toString()).toBe('25000');
    expect(amount.gt(0)).toBe(true);
  });

  it('blocks creation when no active plan applies to the unit', async () => {
    const { svc } = makeService({ plans: [] });
    await expect(svc.createForActor(baseInput)).rejects.toThrow(BadRequestException);
    await expect(svc.createForActor(baseInput)).rejects.toThrow(
      /لا توجد خطة دفع فعّالة/,
    );
  });

  it('requires an explicit choice when several active plans apply', async () => {
    const { svc } = makeService({
      plans: [
        { id: PLAN_ID, unitId: UNIT_ID, reservationAmount: decimal(25000) },
        { id: 'd5555555-5555-4555-8555-555555555555', unitId: null, reservationAmount: decimal(30000) },
      ],
    });
    await expect(svc.createForActor(baseInput)).rejects.toThrow(
      /اختر خطة دفع/,
    );
  });

  it('uses the explicitly-provided plan when multiple apply', async () => {
    const { svc, createdReservation } = makeService({
      plans: [
        { id: PLAN_ID, unitId: UNIT_ID, reservationAmount: decimal(25000) },
        { id: 'd5555555-5555-4555-8555-555555555555', unitId: null, reservationAmount: decimal(30000) },
      ],
    });
    await svc.createForActor({
      ...baseInput,
      dto: { ...baseInput.dto, installmentPlanTemplateId: PLAN_ID },
    });
    expect(createdReservation.data?.installmentPlanTemplateId).toBe(PLAN_ID);
    expect((createdReservation.data?.bookingAmount as Prisma.Decimal).toString()).toBe('25000');
  });

  it('blocks creation when the resolved plan has a zero reservation amount', async () => {
    // findMany filters reservationAmount > 0, but if a stale/explicit plan id
    // resolves to 0 via validateBookingPlan, the guard still rejects.
    const { svc } = makeService({
      plans: [{ id: PLAN_ID, unitId: UNIT_ID, reservationAmount: decimal(0) }],
    });
    await expect(
      svc.createForActor({
        ...baseInput,
        dto: { ...baseInput.dto, installmentPlanTemplateId: PLAN_ID },
      }),
    ).rejects.toThrow(/مبلغ الحجز/);
  });
});
