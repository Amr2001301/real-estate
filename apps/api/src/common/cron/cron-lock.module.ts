import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CronLockService, CRON_LOCK_REDIS } from './cron-lock.service';

@Global()
@Module({
  providers: [
    {
      provide: CRON_LOCK_REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Redis(config.getOrThrow<string>('REDIS_URL'), {
          maxRetriesPerRequest: 1,
          enableReadyCheck: false,
          lazyConnect: true,
        }),
    },
    CronLockService,
  ],
  exports: [CronLockService],
})
export class CronLockModule {}
