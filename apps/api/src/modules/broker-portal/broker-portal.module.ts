import { Module } from '@nestjs/common';
import { ReservationsModule } from '../reservations/reservations.module';
import { BrokerReportsModule } from '../broker-reports/broker-reports.module';
import { BrokerPortalService } from './broker-portal.service';
import { BrokerPortalLeadsService } from './broker-portal-leads.service';
import { BrokerPortalVisitsService } from './broker-portal-visits.service';
import { BrokerPortalActivityService } from './broker-portal-activity.service';
import { BrokerPortalReservationsService } from './broker-portal-reservations.service';
import { BrokerPortalContractsService } from './broker-portal-contracts.service';
import { BrokerPortalCommissionsService } from './broker-portal-commissions.service';
import { BrokerPortalPayoutsService } from './broker-portal-payouts.service';
import { BrokerPortalPerformanceService } from './broker-portal-performance.service';
import { BrokerPortalController } from './broker-portal.controller';

@Module({
  // ReservationsModule re-exports ReservationsService so we can reuse its
  // public helpers (nextReservationNumber / validateBookingPlan) from the
  // broker portal reservations service.
  // BrokerReportsModule re-exports BrokerReportsService so portal performance
  // can reuse the admin report calculations under broker scope.
  imports: [ReservationsModule, BrokerReportsModule],
  controllers: [BrokerPortalController],
  providers: [
    BrokerPortalService,
    BrokerPortalLeadsService,
    BrokerPortalVisitsService,
    BrokerPortalActivityService,
    BrokerPortalReservationsService,
    BrokerPortalContractsService,
    BrokerPortalCommissionsService,
    BrokerPortalPayoutsService,
    BrokerPortalPerformanceService,
  ],
  exports: [
    BrokerPortalService,
    BrokerPortalLeadsService,
    BrokerPortalVisitsService,
    BrokerPortalActivityService,
    BrokerPortalReservationsService,
    BrokerPortalContractsService,
    BrokerPortalCommissionsService,
    BrokerPortalPayoutsService,
    BrokerPortalPerformanceService,
  ],
})
export class BrokerPortalModule {}
