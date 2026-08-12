import { HealthController } from '../health.controller';

function makeController({
  dbOk = true,
  redisOk = true,
  noLock = false,
}: {
  dbOk?: boolean;
  redisOk?: boolean;
  noLock?: boolean;
} = {}) {
  const prisma = {
    $queryRaw: jest.fn().mockImplementation(() =>
      dbOk ? Promise.resolve([{ 1: 1n }]) : Promise.reject(new Error('DB down')),
    ),
  };
  const lock = noLock
    ? undefined
    : { ping: jest.fn().mockResolvedValue(redisOk) };
  // @ts-expect-error — partial mock
  return { controller: new HealthController(prisma, lock), prisma, lock };
}

function makeFakeResponse() {
  let code = 200;
  return {
    res: {
      status(s: number) { code = s; return this; },
      get statusCode() { return code; },
    } as never,
    getCode: () => code,
  };
}

describe('HealthController', () => {
  describe('GET /health/live', () => {
    it('always returns { status: ok } — no DB/Redis check', () => {
      const { controller } = makeController({ dbOk: false, redisOk: false });
      expect(controller.live()).toEqual({ status: 'ok' });
    });
  });

  describe('GET /health/ready', () => {
    it('returns 200 { status: ok } when DB + Redis healthy', async () => {
      const { controller } = makeController({ dbOk: true, redisOk: true });
      const { res, getCode } = makeFakeResponse();
      const body = await controller.ready(res);
      expect(getCode()).toBe(200);
      expect(body).toEqual({ status: 'ok', database: 'ok', redis: 'ok' });
    });

    it('returns 503 { status: degraded } when DB is down', async () => {
      const { controller } = makeController({ dbOk: false, redisOk: true });
      const { res, getCode } = makeFakeResponse();
      const body = await controller.ready(res);
      expect(getCode()).toBe(503);
      expect(body).toMatchObject({ status: 'degraded', database: 'error', redis: 'ok' });
    });

    it('returns 503 { status: degraded } when Redis is down', async () => {
      const { controller } = makeController({ dbOk: true, redisOk: false });
      const { res, getCode } = makeFakeResponse();
      const body = await controller.ready(res);
      expect(getCode()).toBe(503);
      expect(body).toMatchObject({ status: 'degraded', database: 'ok', redis: 'error' });
    });

    it('returns 503 when both DB and Redis are down', async () => {
      const { controller } = makeController({ dbOk: false, redisOk: false });
      const { res, getCode } = makeFakeResponse();
      const body = await controller.ready(res);
      expect(getCode()).toBe(503);
      expect(body).toMatchObject({ status: 'degraded', database: 'error', redis: 'error' });
    });

    it('treats Redis as ok when CronLockService is not available (test env)', async () => {
      const { controller } = makeController({ dbOk: true, noLock: true });
      const { res, getCode } = makeFakeResponse();
      const body = await controller.ready(res);
      expect(getCode()).toBe(200);
      expect(body).toMatchObject({ redis: 'ok' });
    });

    it('response body never contains database credentials or URLs', async () => {
      const { controller } = makeController();
      const { res } = makeFakeResponse();
      const body = await controller.ready(res);
      const serialised = JSON.stringify(body);
      // Checks that no connection strings, credentials, or hostnames leak.
      // "redis" and "database" are field *names*, not credentials — they are allowed.
      expect(serialised).not.toMatch(/postgres:\/\/|mysql:\/\/|redis:\/\/|password|secret|localhost:\d/i);
    });
  });

  describe('GET /health (legacy)', () => {
    it('returns { status: ok, db: true } when DB is healthy', async () => {
      const { controller } = makeController({ dbOk: true });
      const result = await controller.health();
      expect(result).toMatchObject({ status: 'ok', db: true });
    });

    it('returns { status: degraded, db: false } when DB is down', async () => {
      const { controller } = makeController({ dbOk: false });
      const result = await controller.health();
      expect(result).toMatchObject({ status: 'degraded', db: false });
    });

    it('includes a parseable ISO timestamp', async () => {
      const { controller } = makeController();
      const result = await controller.health() as { time: string };
      expect(Number.isFinite(Date.parse(result.time))).toBe(true);
    });
  });
});
