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
import { RequestLoggerInterceptor } from './common/interceptors/request-logger.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';

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
import { UnitMaintenanceItemsModule } from './modules/maintenance/unit-maintenance-items.module';
import { BonusModule } from './modules/bonus/bonus.module';
import { CmsModule } from './modules/cms/cms.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuditModule } from './modules/audit/audit.module';
import { SettingsModule } from './modules/settings/settings.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { BrokersModule } from './modules/brokers/brokers.module';
import { BrokerUsersModule } from './modules/broker-users/broker-users.module';
import { BrokerAccessModule } from './modules/broker-access/broker-access.module';
import { BrokerPortalModule } from './modules/broker-portal/broker-portal.module';
import { BrokerLeadsModule } from './modules/broker-leads/broker-leads.module';
import { BrokerReservationsModule } from './modules/broker-reservations/broker-reservations.module';
import { BrokerContractsModule } from './modules/broker-contracts/broker-contracts.module';
import { BrokerCommissionsModule } from './modules/broker-commissions/broker-commissions.module';
import { BrokerPayoutsModule } from './modules/broker-payouts/broker-payouts.module';
import { BrokerReportsModule } from './modules/broker-reports/broker-reports.module';
import { ChatModule } from './modules/chat/chat.module';
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
    UnitMaintenanceItemsModule,
    BonusModule,
    CmsModule,
    NotificationsModule,
    ReportsModule,
    AuditModule,
    SettingsModule,
    PermissionsModule,
    DocumentsModule,
    BrokersModule,
    BrokerUsersModule,
    BrokerAccessModule,
    BrokerPortalModule,
    BrokerLeadsModule,
    BrokerReservationsModule,
    BrokerContractsModule,
    BrokerCommissionsModule,
    BrokerPayoutsModule,
    BrokerReportsModule,
    ChatModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Runs after RolesGuard: routes without @Permissions short-circuit to allow.
    { provide: APP_GUARD, useClass: PermissionsGuard },
    // Logger runs first so errors thrown by other interceptors still get
    // logged + forwarded to Sentry.
    { provide: APP_INTERCEPTOR, useClass: RequestLoggerInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LocaleInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
