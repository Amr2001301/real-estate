import { MaintenanceUnresolvedCron, MaintenanceSlaCheckCron } from '../maintenance.module';

function makeAcquiredLock() {
  return {
    withLock: jest.fn().mockImplementation(
      async (_key: string, _ttl: number, fn: () => Promise<unknown>) => fn(),
    ),
  };
}

function makeSkippedLock() {
  return { withLock: jest.fn().mockResolvedValue(null) };
}

describe('MaintenanceUnresolvedCron', () => {
  it('calls markUnresolved when lock is acquired', async () => {
    const svc = { markUnresolved: jest.fn().mockResolvedValue({ scanned: 5, marked: 1 }) };
    const lock = makeAcquiredLock();
    const cron = new MaintenanceUnresolvedCron(svc as never, lock as never);

    await cron.run();

    expect(svc.markUnresolved).toHaveBeenCalledTimes(1);
    expect(lock.withLock).toHaveBeenCalledWith('maintenance-unresolved', 2 * 60_000, expect.any(Function));
  });

  it('does NOT call markUnresolved when lock is held by another instance', async () => {
    const svc = { markUnresolved: jest.fn() };
    const cron = new MaintenanceUnresolvedCron(svc as never, makeSkippedLock() as never);

    await cron.run();

    expect(svc.markUnresolved).not.toHaveBeenCalled();
  });
});

describe('MaintenanceSlaCheckCron', () => {
  it('calls checkSla when lock is acquired', async () => {
    const svc = { checkSla: jest.fn().mockResolvedValue({ warned: 0, breached: 0 }) };
    const lock = makeAcquiredLock();
    const cron = new MaintenanceSlaCheckCron(svc as never, lock as never);

    await cron.run();

    expect(svc.checkSla).toHaveBeenCalledTimes(1);
    expect(lock.withLock).toHaveBeenCalledWith('maintenance-sla-check', 2 * 60_000, expect.any(Function));
  });

  it('does NOT call checkSla when lock is not acquired (no duplicate SLA notifications)', async () => {
    const svc = { checkSla: jest.fn() };
    const cron = new MaintenanceSlaCheckCron(svc as never, makeSkippedLock() as never);

    await cron.run();

    expect(svc.checkSla).not.toHaveBeenCalled();
  });
});
