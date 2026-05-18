import { Module } from '@nestjs/common';
import { BrokerReservationsService } from './broker-reservations.service';
import { BrokerReservationsController } from './broker-reservations.controller';

@Module({
  controllers: [BrokerReservationsController],
  providers: [BrokerReservationsService],
  exports: [BrokerReservationsService],
})
export class BrokerReservationsModule {}
