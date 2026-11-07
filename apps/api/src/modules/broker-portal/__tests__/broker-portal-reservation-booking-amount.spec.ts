import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BrokerPortalReservationsService } from '../broker-portal-reservations.service';
import type { PrismaService } from '../../../common/prisma/prisma.service';
import type { ReservationsService } from '../../reservations/reservations.module';

// The plan loader scopes by company (tenant context).
jest.mock('../../../common/tenant/tenant-context', () => ({
  ...jest.requireActual('../../../common/tenant/tenant-context'),
  getRequiredCompanyId: () => 'c0000000-0000-4000-8000-000000000001',
}));

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
    unit: { update: jest.fn().mockResolvedValue({}), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
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
      // The plan loader (installments/plan-applicable.ts) reads the unit's type.
      findFirst: jest.fn().mockResolvedValue({
        id: UNIT_ID,
        type: '2BR',
        price: decimal(500000),
        building: { phase: { projectId: PROJECT_ID } },
      }),
    },
    reservation: { findFirst: jest.fn().mockResolvedValue(null) },
    contract: { count: jest.fn().mockResolvedValue(0) },
    installmentPlanTemplate: {
      findMany: jest.fn().mockImplementation(async () =>
        fixture.plans.map((p) => ({
          id: p.id,
          name: `خطة ${p.id.slice(0, 4)}`,
          status: 'ACTIVE',
          projectId: PROJECT_ID,
          unitId: p.unitId,
          unitTypes: [],
          validFrom: null,
          validTo: null,
          totalPrice: decimal(500000),
          discountAmount: decimal(0),
          discountType: 'PERCENTAGE',
          discountValue: decimal(0),
          netPrice: decimal(500000),
          reservationAmount: p.reservationAmount,
          reservationAmountType: 'FIXED',
          reservationAmountValue: p.reservationAmount,
          downPaymentType: 'FIXED',
          downPaymentValue: decimal(50000),
          downPaymentAmount: decimal(50000),
          finalPaymentAmount: null,
          isCash: false,
          durationOptions: [],
          scheduleItems: [],
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

  const notifications = {
    brokerRecipients: jest.fn().mockResolvedValue([]),
    sendToUsers: jest.fn().mockResolvedValue(undefined),
    sendToRoles: jest.fn().mockResolvedValue(undefined),
  };
  const svc = new BrokerPortalReservationsService(
    prisma as unknown as PrismaService,
    reservations as unknown as ReservationsService,
    notifications as never,
  );
  return { svc, prisma, reservations, createdReservation, notifications };
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

  it('notifies the agent + firm managers, the sales person and the admins — never the actor', async () => {
    const { svc, notifications } = makeService({
      plans: [{ id: PLAN_ID, unitId: UNIT_ID, reservationAmount: decimal(25000) }],
    });
    notifications.brokerRecipients.mockResolvedValue(['agent-1', 'manager-1']);

    await svc.createForActor({ ...baseInput, brokerAgentUserId: 'agent-1' });

    expect(notifications.brokerRecipients).toHaveBeenCalledWith(BROKER_ID, { agentUserId: 'agent-1' });
    const [ids, code, , opts] = notifications.sendToUsers.mock.calls[0];
    expect(ids).toEqual(expect.arrayContaining(['agent-1', 'manager-1']));
    expect(code).toBe('broker_reservation_created');
    expect(opts).toEqual({ except: 'actor-1' });
    expect(notifications.sendToRoles).toHaveBeenCalledWith(
      ['ADMIN', 'SALES_MANAGER'],
      'broker_reservation_created',
      expect.objectContaining({ entityType: 'reservation' }),
      { except: 'actor-1' },
    );
  });

  it('blocks creation when no active plan applies to the unit', async () => {
    const { svc } = makeService({ plans: [] });
    await expect(svc.createForActor(baseInput)).rejects.toThrow(BadRequestException);
    await expect(svc.createForActor(baseInput)).rejects.toThrow(
      /لا توجد خطة دفع متاحة للوسطاء/,
    );
  });

  it('requires an explicit choice when several active plans of the same scope apply', async () => {
    const { svc } = makeService({
      plans: [
        { id: PLAN_ID, unitId: null, reservationAmount: decimal(25000) },
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
        { id: PLAN_ID, unitId: null, reservationAmount: decimal(25000) },
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
    // A plan with no booking amount is not offered, so an explicit id for it is refused.
    const { svc } = makeService({
      plans: [{ id: PLAN_ID, unitId: UNIT_ID, reservationAmount: decimal(0) }],
    });
    await expect(
      svc.createForActor({
        ...baseInput,
        dto: { ...baseInput.dto, installmentPlanTemplateId: PLAN_ID },
      }),
    ).rejects.toThrow(/غير متاحة للوسطاء|مبلغ الحجز/);
  });

  // F-019 / F-039: a unit's own plan overrides the project's, which is not offered on that unit.
  it("a unit's own plan overrides the project's plan (the broker is not asked to choose)", async () => {
    const { svc, createdReservation } = makeService({
      plans: [
        { id: PLAN_ID, unitId: UNIT_ID, reservationAmount: decimal(25000) },
        { id: 'd5555555-5555-4555-8555-555555555555', unitId: null, reservationAmount: decimal(30000) },
      ],
    });
    await svc.createForActor(baseInput);
    expect(createdReservation.data?.installmentPlanTemplateId).toBe(PLAN_ID);
  });
});
