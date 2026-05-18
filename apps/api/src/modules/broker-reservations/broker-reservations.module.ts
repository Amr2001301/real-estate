import { Module } from '@nestjs/common';
import { BrokerPortalModule } from '../broker-portal/broker-portal.module';
import { BrokerReservationsService } from './broker-reservations.service';
import { BrokerReservationsController } from './broker-reservations.controller';

@Module({
  // BrokerPortalModule re-exports BrokerPortalReservationsService so the admin
  // "create on behalf of broker" path (Phase 18A) reuses the same core
  // creation logic the portal uses — never two implementations of a hot
  // financial path.
  imports: [BrokerPortalModule],
  controllers: [BrokerReservationsController],
  providers: [BrokerReservationsService],
  exports: [BrokerReservationsService],
})
export class BrokerReservationsModule {}
