import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';

import { configValidation } from './config/env.validation';
import { PrismaModule } from './common/prisma/prisma.module';
import { LocaleInterceptor } from './common/interceptors/locale.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { PhasesModule } from './modules/phases/phases.module';
import { BuildingsModule } from './modules/buildings/buildings.module';
import { UnitsModule } from './modules/units/units.module';
import { MediaModule } from './modules/media/media.module';
import { LeadsModule } from './modules/leads/leads.module';
import { RequestsModule } from './modules/requests/requests.module';
import { VisitsModule } from './modules/visits/visits.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { InstallmentsModule } from './modules/installments/installments.module';
import { DepositsModule } from './modules/deposits/deposits.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { BonusModule } from './modules/bonus/bonus.module';
import { CmsModule } from './modules/cms/cms.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuditModule } from './modules/audit/audit.module';
import { SettingsModule } from './modules/settings/settings.module';
import { HealthController } from './modules/health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: configValidation,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          url: process.env.REDIS_URL ?? 'redis://localhost:6379',
        },
      }),
    }),
    PrismaModule,

    AuthModule,
    UsersModule,
    ProjectsModule,
    PhasesModule,
    BuildingsModule,
    UnitsModule,
    MediaModule,
    LeadsModule,
    RequestsModule,
    VisitsModule,
    FavoritesModule,
    ReservationsModule,
    ContractsModule,
    InstallmentsModule,
    DepositsModule,
    MaintenanceModule,
    BonusModule,
    CmsModule,
    NotificationsModule,
    ReportsModule,
    AuditModule,
    SettingsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: LocaleInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
