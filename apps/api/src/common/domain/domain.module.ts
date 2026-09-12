/**
 * MT-047 — DomainModule
 *
 * @Global so DomainResolverService is injectable in SuperAdminModule,
 * CompanyDomainsModule, and the public resolve controller without each
 * feature module importing this explicitly.
 *
 * Uses a dedicated ioredis connection following the same pattern as
 * CapabilityModule (CAPABILITY_CACHE_REDIS) and CronLockModule (CRON_LOCK_REDIS).
 */

import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { DOMAIN_CACHE_REDIS, DomainResolverService } from './domain-resolver.service';

@Global()
@Module({
  providers: [
    {
      provide: DOMAIN_CACHE_REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Redis(config.getOrThrow<string>('REDIS_URL'), {
          maxRetriesPerRequest: 1,
          enableReadyCheck: false,
          lazyConnect: true,
        }),
    },
    DomainResolverService,
  ],
  exports: [DomainResolverService],
})
export class DomainModule {}
