/**
 * MT-055 — CompanyBrandingModule
 *
 * Owns the public branding endpoint and caching layer.
 * Uses a dedicated ioredis connection following the same pattern as
 * DomainModule (DOMAIN_CACHE_REDIS) and CapabilityModule (CAPABILITY_CACHE_REDIS).
 */

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { BRANDING_CACHE_REDIS, CompanyBrandingService } from './company-branding.service';
import { PublicBrandingController } from './public-branding.controller';
import { AdminBrandingController } from './admin-branding.controller';

@Module({
  controllers: [PublicBrandingController, AdminBrandingController],
  providers: [
    {
      provide: BRANDING_CACHE_REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Redis(config.getOrThrow<string>('REDIS_URL'), {
          maxRetriesPerRequest: 1,
          enableReadyCheck: false,
          lazyConnect: true,
        }),
    },
    CompanyBrandingService,
  ],
  exports: [CompanyBrandingService],
})
export class CompanyBrandingModule {}
