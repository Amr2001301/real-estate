import { Controller, Get, Optional, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { BypassTenant } from '../../common/decorators/bypass-tenant.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CronLockService } from '../../common/cron/cron-lock.service';

@ApiTags('health')
@BypassTenant()
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly cronLock?: CronLockService,
  ) {}

  /**
   * Liveness — is the API process alive?
   * Never checks external dependencies. A load balancer or Kubernetes liveness
   * probe should hit this endpoint; a non-2xx response causes a restart.
   */
  @Public()
  @Get('health/live')
  live() {
    return { status: 'ok' };
  }

  /**
   * Readiness — can this instance safely serve traffic?
   * Checks PostgreSQL (SELECT 1) and Redis (PING) with short timeouts.
   * Returns HTTP 503 when either dependency is unavailable so the load
   * balancer removes the instance from rotation rather than routing requests
   * to it.
   */
  @Public()
  @Get('health/ready')
  async ready(@Res({ passthrough: true }) res: Response): Promise<object> {
    const [db, redis] = await Promise.all([this.checkDb(), this.checkRedis()]);
    const ok = db && redis;
    res.status(ok ? 200 : 503);
    return {
      status: ok ? 'ok' : 'degraded',
      database: db ? 'ok' : 'error',
      redis: redis ? 'ok' : 'error',
    };
  }

  /**
   * Legacy combined health check — retained for backward compatibility with
   * the existing CI e2e suite. New monitors should prefer /health/live and
   * /health/ready.
   */
  @Public()
  @Get('health')
  async health(): Promise<object> {
    const db = await this.checkDb();
    return { status: db ? 'ok' : 'degraded', db, time: new Date().toISOString() };
  }

  @Public()
  @Get()
  root() {
    return { name: 'real-estate-api', version: '0.1.0', docs: '/docs' };
  }

  private async checkDb(): Promise<boolean> {
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('DB health check timeout')), 3_000),
        ),
      ]);
      return true;
    } catch {
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    if (!this.cronLock) return true; // not wired in isolated test modules — skip
    return this.cronLock.ping();
  }
}
