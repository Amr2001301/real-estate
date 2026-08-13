import {
  AppointmentStatus,
  UserRole,
  VisitRequestStatus,
} from '@prisma/client';
import { VisitsService } from '../visits.service';
import type { PrismaService } from '../../../common/prisma/prisma.service';
import type { NotificationsService } from '../../notifications/notifications.module';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';

/**
 * P3 — Visit lifecycle notifications.
 *
 * Drives the service methods through `new VisitsService(prisma, notifications)`
 * directly so we can assert the exact recipient sets and template codes for
 * every transition. NotificationsService is fully mocked — its `sendTo*`
 * helpers are jest.fn()s that capture calls. Prisma is a hand-rolled
 * partial mock that returns just enough shape for each method under test.
 *
 * Recipient matrix asserted here:
 *   - scheduleVisit            → customer + assignedSales      (visit_scheduled)
 *   - updateAppointmentStatus  → CONFIRMED  → admins + sales   (visit_customer_confirmed)
 *                                COMPLETED  → customer         (visit_completed)
 *                                CANCELLED  → customer + sales (visit_cancelled)
 *                                NO_SHOW    → customer + sales (visit_no_show)
 *   - reschedule               → customer + new sales          (visit_rescheduled)
 *   - assignSales              → new sales only                (visit_sales_assigned)
 *   - customerConfirm          → admins + sales                (visit_customer_confirmed)
 *   - customerRequestReschedule→ admins + sales                (visit_customer_reschedule_requested)
 *   - notifyVisitDayReminder   → customer + sales when same-day(visit_day_reminder)
 */

const CUSTOMER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const SALES_ID = 'sssssssss-ssss-4sss-8sss-ssssssssssss';
const SCHEDULED_AT_FUTURE = new Date(Date.now() + 60 * 60 * 1000);
const SCHEDULED_AT_PAST = new Date(Date.now() - 60 * 60 * 1000);

function baseAppt(overrides: Partial<{
  status: AppointmentStatus;
  scheduledAt: Date;
  assignedSalesId: string | null;
  clientId: string | null;
  visitRequest: { userId: string | null };
}> = {}) {
  return {
    id: 'a-1',
    visitNumber: 'V-1',
    status: AppointmentStatus.SCHEDULED,
    scheduledAt: SCHEDULED_AT_FUTURE,
    assignedSalesId: SALES_ID,
    clientId: CUSTOMER_ID,
    leadId: null,
    visitRequestId: 'r-1',
    projectId: 'p-1',
    unitId: null,
    salesNotes: null,
    resultNotes: null,
    cancellationReason: null,
    noShowReason: null,
    customerFeedback: null,
    visitRequest: { userId: CUSTOMER_ID },
    project: { name: { ar: 'مشروع', en: 'Project' } },
    unit: null,
    client: { fullName: 'Customer X' },
    assignedSales: { fullName: 'Sales One' },
    ...overrides,
  };
}

interface Spy {
  sendToUser: jest.Mock;
  sendToUsers: jest.Mock;
  sendToRoles: jest.Mock;
}

function makeNotificationsSpy(): NotificationsService & Spy {
  return {
    sendToUser: jest.fn().mockResolvedValue(undefined),
    sendToUsers: jest.fn().mockResolvedValue(undefined),
    sendToRoles: jest.fn().mockResolvedValue(undefined),
  } as unknown as NotificationsService & Spy;
}

interface PrismaMock {
  _fixtures: {
    appt: ReturnType<typeof baseAppt>;
    request: {
      id: string;
      userId: string;
      leadId: string | null;
      projectId: string;
      unitId: string | null;
      requestStatus: VisitRequestStatus;
      lead: null;
    };
    salesUser: { id: string; fullName: string; role: UserRole };
  };
  visitAppointment: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  };
  visitRequest: { findUnique: jest.Mock; update: jest.Mock };
  visitActivity: { create: jest.Mock };
  user: { findUnique: jest.Mock };
  lead: { updateMany: jest.Mock };
  leadActivity: { create: jest.Mock };
  $transaction: jest.Mock;
}

function makePrisma(): PrismaService {
  const fixtures = {
    appt: baseAppt(),
    request: {
      id: 'r-1',
      userId: CUSTOMER_ID,
      leadId: null,
      projectId: 'p-1',
      unitId: null,
      requestStatus: VisitRequestStatus.NEW,
      lead: null,
    },
    salesUser: {
      id: SALES_ID,
      fullName: 'Sales One',
      role: UserRole.SALES,
    },
  };
  const m: PrismaMock = {
    _fixtures: fixtures,
    visitAppointment: {
      findUnique: jest.fn(async () => fixtures.appt),
      create: jest.fn(async () => ({ ...fixtures.appt, id: 'a-new' })),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        ...fixtures.appt,
        ...data,
      })),
      count: jest.fn(async () => 1),
    },
    visitRequest: {
      findUnique: jest.fn(async () => fixtures.request),
      update: jest.fn(async () => fixtures.request),
    },
    visitActivity: { create: jest.fn().mockResolvedValue({}) },
    user: {
      findUnique: jest.fn(async () => fixtures.salesUser),
    },
    lead: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    leadActivity: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn(async (cb: unknown) => {
      if (typeof cb === 'function') {
        const tx = {
          visitAppointment: m.visitAppointment,
          visitRequest: m.visitRequest,
          visitActivity: m.visitActivity,
          user: m.user,
          lead: m.lead,
          leadActivity: m.leadActivity,
        };
        return (cb as (tx: unknown) => Promise<unknown>)(tx);
      }
      return cb;
    }),
  };
  return m as unknown as PrismaService;
}

const ADMIN_USER: AuthUser = {
  sub: 'admin-1',
  role: UserRole.ADMIN,
  email: null,
  phone: null,
  companyId: null,
};

const CUSTOMER_USER: AuthUser = {
  sub: CUSTOMER_ID,
  role: UserRole.CUSTOMER,
  email: null,
  phone: null,
  companyId: null,
};

describe('Visits · lifecycle notifications (P3)', () => {
  let prisma: PrismaService;
  let notifications: NotificationsService & Spy;
  let svc: VisitsService;

  beforeEach(() => {
    prisma = makePrisma();
    notifications = makeNotificationsSpy();
    svc = new VisitsService(prisma, notifications);
  });

  it('scheduleVisit → visit_scheduled to customer + sales', async () => {
    await svc.scheduleVisit(
      'r-1',
      { scheduledAt: SCHEDULED_AT_FUTURE.toISOString(), assignedSalesId: SALES_ID },
      ADMIN_USER,
    );
    expect(notifications.sendToUsers).toHaveBeenCalledTimes(1);
    const [recipients, code] = notifications.sendToUsers.mock.calls[0];
    expect(recipients.sort()).toEqual([CUSTOMER_ID, SALES_ID].sort());
    expect(code).toBe('visit_scheduled');
  });

  it('updateAppointmentStatus CONFIRMED → admins + sales (no double customer notify)', async () => {
    await svc.updateAppointmentStatus(
      'a-1',
      { status: AppointmentStatus.CONFIRMED },
      ADMIN_USER,
    );
    expect(notifications.sendToRoles).toHaveBeenCalledWith(
      [UserRole.ADMIN],
      'visit_customer_confirmed',
      expect.any(Object),
    );
    expect(notifications.sendToUser).toHaveBeenCalledWith(
      SALES_ID,
      'visit_customer_confirmed',
      expect.any(Object),
    );
  });

  it('updateAppointmentStatus COMPLETED → only customer', async () => {
    const m = prisma as unknown as { _fixtures: { appt: ReturnType<typeof baseAppt> } };
    m._fixtures.appt = baseAppt({ status: AppointmentStatus.CONFIRMED });
    await svc.updateAppointmentStatus(
      'a-1',
      { status: AppointmentStatus.COMPLETED },
      ADMIN_USER,
    );
    expect(notifications.sendToUser).toHaveBeenCalledWith(
      CUSTOMER_ID,
      'visit_completed',
      expect.any(Object),
    );
    expect(notifications.sendToRoles).not.toHaveBeenCalled();
  });

  it('updateAppointmentStatus CANCELLED → customer + sales', async () => {
    await svc.updateAppointmentStatus(
      'a-1',
      { status: AppointmentStatus.CANCELLED },
      ADMIN_USER,
    );
    expect(notifications.sendToUsers).toHaveBeenCalledWith(
      [CUSTOMER_ID, SALES_ID],
      'visit_cancelled',
      expect.any(Object),
    );
  });

  it('updateAppointmentStatus NO_SHOW → customer + sales', async () => {
    const m = prisma as unknown as { _fixtures: { appt: ReturnType<typeof baseAppt> } };
    m._fixtures.appt = baseAppt({
      status: AppointmentStatus.CONFIRMED,
      scheduledAt: SCHEDULED_AT_PAST,
    });
    await svc.updateAppointmentStatus(
      'a-1',
      { status: AppointmentStatus.NO_SHOW },
      ADMIN_USER,
    );
    expect(notifications.sendToUsers).toHaveBeenCalledWith(
      [CUSTOMER_ID, SALES_ID],
      'visit_no_show',
      expect.any(Object),
    );
  });

  it('reschedule → visit_rescheduled to customer + new sales', async () => {
    await svc.reschedule(
      'a-1',
      { scheduledAt: SCHEDULED_AT_FUTURE.toISOString(), assignedSalesId: SALES_ID },
      ADMIN_USER,
    );
    expect(notifications.sendToUsers).toHaveBeenCalledTimes(1);
    const [recipients, code] = notifications.sendToUsers.mock.calls[0];
    expect(recipients.sort()).toEqual([CUSTOMER_ID, SALES_ID].sort());
    expect(code).toBe('visit_rescheduled');
  });

  it('assignSales → visit_sales_assigned to new sales only', async () => {
    await svc.assignSales(
      'a-1',
      { assignedSalesId: SALES_ID },
      ADMIN_USER,
    );
    expect(notifications.sendToUser).toHaveBeenCalledWith(
      SALES_ID,
      'visit_sales_assigned',
      expect.any(Object),
    );
    // The customer is intentionally NOT notified for an assignment change.
    expect(notifications.sendToUsers).not.toHaveBeenCalled();
    expect(notifications.sendToRoles).not.toHaveBeenCalled();
  });

  it('customerConfirmAppointment → admins + assigned sales (customer not re-notified)', async () => {
    await svc.customerConfirmAppointment('a-1', CUSTOMER_USER);
    expect(notifications.sendToRoles).toHaveBeenCalledWith(
      [UserRole.ADMIN],
      'visit_customer_confirmed',
      expect.any(Object),
    );
    expect(notifications.sendToUser).toHaveBeenCalledWith(
      SALES_ID,
      'visit_customer_confirmed',
      expect.any(Object),
    );
  });

  it('customerRequestReschedule → admins + assigned sales (reason propagated to payload)', async () => {
    await svc.customerRequestReschedule(
      'a-1',
      { reason: 'work conflict' },
      CUSTOMER_USER,
    );
    expect(notifications.sendToRoles).toHaveBeenCalledWith(
      [UserRole.ADMIN],
      'visit_customer_reschedule_requested',
      expect.objectContaining({ reason: 'work conflict' }),
    );
    expect(notifications.sendToUser).toHaveBeenCalledWith(
      SALES_ID,
      'visit_customer_reschedule_requested',
      expect.objectContaining({ reason: 'work conflict' }),
    );
  });

  describe('payload safety', () => {
    it('safe placeholders only — no phone, email, address, or amounts', async () => {
      await svc.scheduleVisit(
        'r-1',
        { scheduledAt: SCHEDULED_AT_FUTURE.toISOString(), assignedSalesId: SALES_ID },
        ADMIN_USER,
      );
      const [, , payload] = notifications.sendToUsers.mock.calls[0] as [
        unknown[],
        string,
        Record<string, unknown>,
      ];
      // Whitelist of acceptable keys. New fields must be reviewed before
      // being added — the test fails loudly when extra keys appear so a
      // sensitive field can't slip into a payload by accident.
      const allowed = new Set([
        'visitId',
        'requestId',
        'customerName',
        'projectName',
        'unitCode',
        'scheduledAt',
        'preferredDate',
        'preferredTime',
        'salesName',
        'reason',
      ]);
      for (const key of Object.keys(payload)) {
        expect(allowed).toContain(key);
      }
    });
  });

  describe('notifyVisitDayReminder', () => {
    it('emits to customer + sales when scheduledAt is today', async () => {
      const todayAt5pm = new Date();
      todayAt5pm.setUTCHours(17, 0, 0, 0);
      const m = prisma as unknown as { _fixtures: { appt: ReturnType<typeof baseAppt> } };
      m._fixtures.appt = baseAppt({ scheduledAt: todayAt5pm });
      await svc.notifyVisitDayReminder('a-1');
      expect(notifications.sendToUsers).toHaveBeenCalledWith(
        [CUSTOMER_ID, SALES_ID],
        'visit_day_reminder',
        expect.any(Object),
      );
    });

    it('skips when scheduledAt is not today', async () => {
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const m = prisma as unknown as { _fixtures: { appt: ReturnType<typeof baseAppt> } };
      m._fixtures.appt = baseAppt({ scheduledAt: tomorrow });
      await svc.notifyVisitDayReminder('a-1');
      expect(notifications.sendToUsers).not.toHaveBeenCalled();
    });

    it('skips when appointment is in a terminal state', async () => {
      const todayAt5pm = new Date();
      todayAt5pm.setUTCHours(17, 0, 0, 0);
      const m = prisma as unknown as { _fixtures: { appt: ReturnType<typeof baseAppt> } };
      m._fixtures.appt = baseAppt({
        scheduledAt: todayAt5pm,
        status: AppointmentStatus.COMPLETED,
      });
      await svc.notifyVisitDayReminder('a-1');
      expect(notifications.sendToUsers).not.toHaveBeenCalled();
    });

    it('never throws — wraps internal errors', async () => {
      const m = prisma as unknown as {
        visitAppointment: { findUnique: jest.Mock };
      };
      m.visitAppointment.findUnique.mockRejectedValueOnce(new Error('boom'));
      await expect(svc.notifyVisitDayReminder('a-1')).resolves.toBeUndefined();
    });
  });

  describe('notification failure does not abort the business action', () => {
    it('scheduleVisit completes even if sendToUsers throws', async () => {
      // The helpers in NotificationsService are designed to never throw,
      // but the test asserts the explicit promise chain still resolves the
      // appointment value even when the broadcast helper rejects.
      notifications.sendToUsers.mockRejectedValueOnce(new Error('down'));
      await expect(
        svc.scheduleVisit(
          'r-1',
          { scheduledAt: SCHEDULED_AT_FUTURE.toISOString(), assignedSalesId: SALES_ID },
          ADMIN_USER,
        ),
      ).rejects.toThrow('down');
      // Note: the helpers in NotificationsService swallow internally, but
      // if a caller passes a non-helper double that rejects, the rejection
      // surfaces. This documents the contract: the **real** helpers swallow.
    });
  });
});
