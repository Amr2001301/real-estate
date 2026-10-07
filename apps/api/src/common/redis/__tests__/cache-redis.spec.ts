import type Redis from 'ioredis';
import { createCacheRedis } from '../cache-redis';
import { CapabilityService } from '../../capabilities/capability.service';

// G16 — when Redis is unreachable a request-path cache must fail at once so
// the caller's database fallback runs, instead of waiting on reconnect retries.
// Port 1 on loopback refuses connections; no Redis server is needed.
const DEAD_REDIS = 'redis://127.0.0.1:1';
const FAST_MS = 250;

describe('createCacheRedis — Redis unreachable', () => {
  let client: Redis;

  beforeEach(() => {
    client = createCacheRedis(DEAD_REDIS, 'test');
  });

  afterEach(() => {
    client.disconnect();
  });

  it('rejects every command at once instead of queueing it', async () => {
    for (let i = 0; i < 3; i++) {
      const started = Date.now();
      await expect(client.get('k')).rejects.toThrow(/enableOfflineQueue|writeable|ECONNREFUSED/);
      expect(Date.now() - started).toBeLessThan(FAST_MS);
    }
  });

  it('CapabilityService serves the capability from the database without waiting', async () => {
    const prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue({
          subscriptionPlan: 'TRIAL',
          capabilities: { 'feature.staffApp': true },
          websiteEnabled: null,
          customerAppEnabled: null,
          staffAppEnabled: true,
        }),
      },
    };
    const svc = new CapabilityService(prisma as never, client);

    const started = Date.now();
    await expect(svc.hasCapability('company-1', 'feature.staffApp')).resolves.toBe(true);
    expect(Date.now() - started).toBeLessThan(FAST_MS);
    expect(prisma.company.findUnique).toHaveBeenCalledTimes(1);
  });
});
