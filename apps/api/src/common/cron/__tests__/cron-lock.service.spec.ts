import { CronLockService } from '../cron-lock.service';

function makeRedis(overrides: {
  set?: jest.Mock;
  eval?: jest.Mock;
  quit?: jest.Mock;
} = {}) {
  return {
    set: overrides.set ?? jest.fn(),
    eval: overrides.eval ?? jest.fn(),
    quit: overrides.quit ?? jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
  };
}

function makeService(redis = makeRedis()): CronLockService {
  return new CronLockService(redis as never);
}

describe('CronLockService.withLock', () => {
  it('acquires lock and calls fn when key is free', async () => {
    const redis = makeRedis({
      set: jest.fn().mockResolvedValue('OK'),
      eval: jest.fn().mockResolvedValue(1),
    });
    const fn = jest.fn().mockResolvedValue('result');
    const result = await makeService(redis).withLock('test-key', 5_000, fn);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(result).toBe('result');
    expect(redis.set).toHaveBeenCalledWith(
      'cron-lock:test-key',
      expect.any(String),
      'PX',
      5_000,
      'NX',
    );
  });

  it('returns null without calling fn when lock is already held (contention)', async () => {
    const redis = makeRedis({ set: jest.fn().mockResolvedValue(null) });
    const fn = jest.fn();
    const result = await makeService(redis).withLock('contended', 5_000, fn);

    expect(fn).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('different keys are independent (one held, other free)', async () => {
    const redis = makeRedis({
      set: jest
        .fn()
        .mockResolvedValueOnce(null) // key-a held
        .mockResolvedValueOnce('OK'), // key-b free
      eval: jest.fn().mockResolvedValue(1),
    });
    const fn = jest.fn().mockResolvedValue('b-result');
    const svc = makeService(redis);

    expect(await svc.withLock('key-a', 5_000, fn)).toBeNull();
    expect(await svc.withLock('key-b', 5_000, fn)).toBe('b-result');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('releases lock via Lua script after fn completes (ownership-safe)', async () => {
    let capturedOwner: string | null = null;
    const redis = makeRedis({
      set: jest.fn().mockImplementation((_key, owner) => {
        capturedOwner = owner as string;
        return Promise.resolve('OK');
      }),
      eval: jest.fn().mockResolvedValue(1),
    });
    const fn = jest.fn().mockResolvedValue(undefined);
    await makeService(redis).withLock('release-test', 5_000, fn);

    // The Lua release script must be called with the lock key and the SAME owner token
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call("del"'),
      1,
      'cron-lock:release-test',
      capturedOwner,
    );
  });

  it('still releases lock when fn throws (no lock leak on error)', async () => {
    const redis = makeRedis({
      set: jest.fn().mockResolvedValue('OK'),
      eval: jest.fn().mockResolvedValue(1),
    });
    const fn = jest.fn().mockRejectedValue(new Error('fn-error'));

    await expect(makeService(redis).withLock('throw-test', 5_000, fn)).rejects.toThrow('fn-error');
    expect(redis.eval).toHaveBeenCalledTimes(1);
  });

  it('returns null when Redis is unavailable (fail-closed — does not run job)', async () => {
    const redis = makeRedis({
      set: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    });
    const fn = jest.fn();
    const result = await makeService(redis).withLock('redis-down', 5_000, fn);

    expect(fn).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('survives release failure without re-throwing (TTL fallback)', async () => {
    const redis = makeRedis({
      set: jest.fn().mockResolvedValue('OK'),
      eval: jest.fn().mockRejectedValue(new Error('connection closed')),
    });
    const fn = jest.fn().mockResolvedValue('ok');

    await expect(makeService(redis).withLock('release-fail', 5_000, fn)).resolves.toBe('ok');
  });

  it('uses unique owner tokens per acquisition (no cross-lock identity collision)', async () => {
    const owners: string[] = [];
    const redis = makeRedis({
      set: jest.fn().mockImplementation((_key, owner) => {
        owners.push(owner as string);
        return Promise.resolve('OK');
      }),
      eval: jest.fn().mockResolvedValue(1),
    });
    const fn = jest.fn().mockResolvedValue(undefined);
    const svc = makeService(redis);

    await svc.withLock('key-1', 5_000, fn);
    await svc.withLock('key-2', 5_000, fn);

    expect(owners).toHaveLength(2);
    expect(owners[0]).not.toBe(owners[1]);
  });
});
