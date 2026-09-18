import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CAPABILITY_CACHE_REDIS, CapabilityService } from './capability.service';
import { PlanLimitService } from './plan-limit.service';
import { CapabilityGuard } from '../guards/capability.guard';

/**
 * MT-038 — @Global module so CapabilityService, PlanLimitService, and CapabilityGuard
 * are injectable everywhere without each feature module importing this explicitly.
 * Uses a dedicated ioredis connection (separate from CronLockModule's lock redis).
 */
@Global()
@Module({
  providers: [
    {
      provide: CAPABILITY_CACHE_REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Redis(config.getOrThrow<string>('REDIS_URL'), {
          maxRetriesPerRequest: 1,
          enableReadyCheck: false,
          lazyConnect: true,
        }),
    },
    CapabilityService,
    PlanLimitService,
    CapabilityGuard,
  ],
  exports: [CapabilityService, PlanLimitService, CapabilityGuard],
})
export class CapabilityModule {}
