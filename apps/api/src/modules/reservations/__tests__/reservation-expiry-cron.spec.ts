import { ReservationExpiryCron } from '../reservations.module';

function makeExpireResult(expired = 0) {
  return { expired };
}

function makeSvc(expired = 0) {
  return { expireDue: jest.fn().mockResolvedValue(makeExpireResult(expired)) };
}

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

describe('ReservationExpiryCron', () => {
  it('calls expireDue when lock is acquired', async () => {
    const svc = makeSvc(3);
    const lock = makeAcquiredLock();
    const cron = new ReservationExpiryCron(svc as never, lock as never);

    await cron.run();

    expect(svc.expireDue).toHaveBeenCalledTimes(1);
    expect(lock.withLock).toHaveBeenCalledWith('reservation-expiry', 4 * 60_000, expect.any(Function));
  });

  it('does NOT call expireDue when lock is held by another instance', async () => {
    const svc = makeSvc();
    const lock = makeSkippedLock();
    const cron = new ReservationExpiryCron(svc as never, lock as never);

    await cron.run();

    expect(svc.expireDue).not.toHaveBeenCalled();
  });

  it('does NOT call expireDue when Redis is unavailable (fail-closed)', async () => {
    const svc = makeSvc();
    const lock = makeSkippedLock(); // withLock returns null = Redis down or lock held
    const cron = new ReservationExpiryCron(svc as never, lock as never);

    await cron.run();

    expect(svc.expireDue).not.toHaveBeenCalled();
  });
});
