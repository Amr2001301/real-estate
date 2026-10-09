/**
 * MT-055 — CompanyBrandingModule
 *
 * Owns the public branding endpoint and caching layer.
 * Uses a dedicated ioredis connection following the same pattern as
 * DomainModule (DOMAIN_CACHE_REDIS) and CapabilityModule (CAPABILITY_CACHE_REDIS).
 */

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCacheRedis } from '../../common/redis/cache-redis';
import { BRANDING_CACHE_REDIS, CompanyBrandingService } from './company-branding.service';
import { PublicBrandingController } from './public-branding.controller';
import { AdminBrandingController, CompanyCurrencyController } from './admin-branding.controller';

@Module({
  controllers: [PublicBrandingController, AdminBrandingController, CompanyCurrencyController],
  providers: [
    {
      provide: BRANDING_CACHE_REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        createCacheRedis(config.getOrThrow<string>('REDIS_URL'), 'branding'),
    },
    CompanyBrandingService,
  ],
  exports: [CompanyBrandingService],
})
export class CompanyBrandingModule {}
