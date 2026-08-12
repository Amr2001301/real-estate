import {
  InstallmentDueSoonCron,
  InstallmentRemindersService,
  InstallmentsCron,
} from '../installments.module';

/**
 * P11.7 — InstallmentRemindersService.run() + the env gate on
 * InstallmentDueSoonCron. The service is constructed by hand with a partial
 * Prisma mock + a NotificationsService spy + a ConfigService stub, and run()
 * is called directly (the schedule is bypassed) — mirroring the codebase's
 * service-notification spec style.
 */

interface DueOverrides {
  id?: string;
  dueDate?: Date;
  amount?: number;
  customerId?: string | null;
}

function dec(n: number) {
  return { toString: () => String(n) } as unknown as import('@prisma/client').Prisma.Decimal;
}

function dueRow(o: DueOverrides = {}) {
  return {
    id: o.id ?? 'inst-1',
    planId: 'plan-1',
    dueDate: o.dueDate ?? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    amount: dec(o.amount ?? 5000),
    plan: {
      contract: {
        id: 'c1',
        contractNumber: 'CON-1',
        customerId: o.customerId === undefined ? 'cust-1' : o.customerId,
        unit: {
          code: 'A-1',
          building: { phase: { project: { name: { ar: 'مشروع', en: 'Project' } } } },
        },
      },
    },
  };
}

function makePrisma(rows: ReturnType<typeof dueRow>[], opts: { alreadySent?: boolean } = {}) {
  return {
    installment: {
      findMany: jest.fn().mockResolvedValue(rows),
      count: jest.fn().mockResolvedValue(3), // ordinal within plan
    },
    notification: {
      findFirst: jest.fn().mockResolvedValue(opts.alreadySent ? { id: 'n-1' } : null),
    },
  };
}

function makeNotifications() {
  return { sendToUser: jest.fn().mockResolvedValue(undefined) };
}

function makeConfig(values: Record<string, string | undefined> = {}) {
  return { get: jest.fn((k: string) => values[k]) };
}

function buildService(prisma: ReturnType<typeof makePrisma>, notifications: ReturnType<typeof makeNotifications>, config = makeConfig()) {
  return new InstallmentRemindersService(
    prisma as never,
    notifications as never,
    config as never,
  );
}

describe('InstallmentRemindersService.run', () => {
  it('queries only PENDING installments in the window for ACTIVE customers', async () => {
    const prisma = makePrisma([dueRow()]);
    const svc = buildService(prisma, makeNotifications(), makeConfig({ INSTALLMENT_REMINDER_DAYS_BEFORE: '3' }));
    await svc.run({ dryRun: false });

    const where = prisma.installment.findMany.mock.calls[0]![0].where;
    expect(where.status).toBe('PENDING'); // paid/overdue excluded by the query
    expect(where.plan).toEqual({ contract: { customer: { active: true } } });
    expect(where.dueDate.gte).toBeInstanceOf(Date);
    expect(where.dueDate.lte).toBeInstanceOf(Date);
    // window end ≈ now + 3 days
    const spanDays = (where.dueDate.lte.getTime() - where.dueDate.gte.getTime()) / (24 * 60 * 60 * 1000);
    expect(spanDays).toBeGreaterThan(2.9);
    expect(spanDays).toBeLessThan(4);
  });

  it('creates a notification for the contract customer with a SAFE payload', async () => {
    const prisma = makePrisma([dueRow({ id: 'inst-9', amount: 7500 })]);
    const notifications = makeNotifications();
    const svc = buildService(prisma, notifications);
    const summary = await svc.run({ dryRun: false });

    expect(summary).toMatchObject({ scanned: 1, sent: 1, skipped: 0, failed: 0 });
    expect(notifications.sendToUser).toHaveBeenCalledTimes(1);
    const [userId, template, payload] = notifications.sendToUser.mock.calls[0]!;
    expect(userId).toBe('cust-1');
    expect(template).toBe('installment_due_soon');
    expect(payload).toMatchObject({
      installmentId: 'inst-9',
      contractId: 'c1',
      amount: '7500',
      contractNumber: 'CON-1',
      unitCode: 'A-1',
      projectName: 'مشروع',
      installmentNumber: 3,
    });
    expect(payload.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // CRITICAL: no contact / URL / bank details leak into the payload.
    const serialised = JSON.stringify(payload);
    expect(serialised).not.toMatch(/phone|email|http|receipt|iban|bank/i);
  });

  it('skips an installment with no linked customer (never notifies)', async () => {
    const prisma = makePrisma([dueRow({ customerId: null })]);
    const notifications = makeNotifications();
    const summary = await buildService(prisma, notifications).run({ dryRun: false });
    expect(summary).toMatchObject({ scanned: 1, sent: 0, skipped: 1 });
    expect(notifications.sendToUser).not.toHaveBeenCalled();
  });

  it('is idempotent: does not re-send when a reminder already exists for installment+dueDate', async () => {
    const prisma = makePrisma([dueRow()], { alreadySent: true });
    const notifications = makeNotifications();
    const summary = await buildService(prisma, notifications).run({ dryRun: false });
    expect(summary).toMatchObject({ scanned: 1, sent: 0, skipped: 1 });
    expect(notifications.sendToUser).not.toHaveBeenCalled();
    // The dedupe keys on templateCode + userId + payload.installmentId + dueDate.
    const where = prisma.notification.findFirst.mock.calls[0]![0].where;
    expect(where.templateCode).toBe('installment_due_soon');
    expect(where.userId).toBe('cust-1');
    expect(where.AND).toEqual([
      { payload: { path: ['installmentId'], equals: 'inst-1' } },
      { payload: { path: ['dueDate'], equals: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) } },
    ]);
  });

  it('dry-run creates NO notifications but reports would-send counts', async () => {
    const prisma = makePrisma([dueRow(), dueRow({ id: 'inst-2' })]);
    const notifications = makeNotifications();
    const summary = await buildService(prisma, notifications).run({ dryRun: true });
    expect(summary).toMatchObject({ scanned: 2, sent: 2, skipped: 0 });
    expect(notifications.sendToUser).not.toHaveBeenCalled();
  });

  it('a send failure increments failed and never aborts the run', async () => {
    const prisma = makePrisma([dueRow({ id: 'a' }), dueRow({ id: 'b' })]);
    const notifications = makeNotifications();
    notifications.sendToUser
      .mockRejectedValueOnce(new Error('push down')) // first fails
      .mockResolvedValueOnce(undefined); // second succeeds
    const summary = await buildService(prisma, notifications).run({ dryRun: false });
    expect(summary).toMatchObject({ scanned: 2, sent: 1, failed: 1 });
  });

  it('uses the default 3-day window when INSTALLMENT_REMINDER_DAYS_BEFORE is unset', async () => {
    const prisma = makePrisma([]);
    await buildService(prisma, makeNotifications(), makeConfig({})).run({ dryRun: true });
    const where = prisma.installment.findMany.mock.calls[0]![0].where;
    const spanDays = (where.dueDate.lte.getTime() - where.dueDate.gte.getTime()) / (24 * 60 * 60 * 1000);
    expect(spanDays).toBeGreaterThan(2.9);
    expect(spanDays).toBeLessThan(4);
  });
});

describe('InstallmentDueSoonCron env gate', () => {
  function makePassthroughLock() {
    return {
      withLock: jest.fn().mockImplementation(
        async (_k: string, _t: number, fn: () => Promise<unknown>) => fn(),
      ),
    };
  }

  function makeSkippedLock() {
    return { withLock: jest.fn().mockResolvedValue(null) };
  }

  it('does NOT run when INSTALLMENT_REMINDERS_ENABLED is unset/false', async () => {
    const reminders = { run: jest.fn().mockResolvedValue(undefined) };
    const lock = makePassthroughLock();
    const cronOff = new InstallmentDueSoonCron(reminders as never, makeConfig({}) as never, lock as never);
    await cronOff.daily();
    expect(reminders.run).not.toHaveBeenCalled();

    const cronFalse = new InstallmentDueSoonCron(
      reminders as never,
      makeConfig({ INSTALLMENT_REMINDERS_ENABLED: 'false' }) as never,
      lock as never,
    );
    await cronFalse.daily();
    expect(reminders.run).not.toHaveBeenCalled();
  });

  it('runs (execute mode) when INSTALLMENT_REMINDERS_ENABLED=true', async () => {
    const reminders = { run: jest.fn().mockResolvedValue(undefined) };
    const cron = new InstallmentDueSoonCron(
      reminders as never,
      makeConfig({ INSTALLMENT_REMINDERS_ENABLED: 'true' }) as never,
      makePassthroughLock() as never,
    );
    await cron.daily();
    expect(reminders.run).toHaveBeenCalledWith({ dryRun: false });
  });

  it('does NOT run when lock is not acquired (no duplicate reminders)', async () => {
    const reminders = { run: jest.fn().mockResolvedValue(undefined) };
    const cron = new InstallmentDueSoonCron(
      reminders as never,
      makeConfig({ INSTALLMENT_REMINDERS_ENABLED: 'true' }) as never,
      makeSkippedLock() as never,
    );
    await cron.daily();
    expect(reminders.run).not.toHaveBeenCalled();
  });
});

describe('InstallmentsCron lock behavior', () => {
  it('calls markOverdue when lock is acquired', async () => {
    const svc = { markOverdue: jest.fn().mockResolvedValue(undefined) };
    const lock = {
      withLock: jest.fn().mockImplementation(
        async (_k: string, _t: number, fn: () => Promise<unknown>) => fn(),
      ),
    };
    const cron = new InstallmentsCron(svc as never, lock as never);
    await cron.daily();

    expect(svc.markOverdue).toHaveBeenCalledTimes(1);
    expect(lock.withLock).toHaveBeenCalledWith('installments-mark-overdue', 5 * 60_000, expect.any(Function));
  });

  it('does NOT call markOverdue when lock is held by another instance', async () => {
    const svc = { markOverdue: jest.fn() };
    const lock = { withLock: jest.fn().mockResolvedValue(null) };
    const cron = new InstallmentsCron(svc as never, lock as never);
    await cron.daily();

    expect(svc.markOverdue).not.toHaveBeenCalled();
  });
});
