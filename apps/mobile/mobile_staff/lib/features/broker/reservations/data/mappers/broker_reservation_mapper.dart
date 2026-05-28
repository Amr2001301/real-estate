import '../../domain/entities/broker_reservation.dart';
import '../dtos/broker_reservation_dtos.dart';

DateTime? _d(String? s) => DateTime.tryParse(s ?? '');

extension BrokerReservationDtoMapper on BrokerReservationDto {
  BrokerReservation toEntity() => BrokerReservation(
        id: id,
        status: status,
        reservationNumber: reservationNumber,
        expiresAt: _d(expiresAt),
        createdAt: _d(createdAt),
        unitCode: unitCode,
        projectName: projectName,
        clientName: clientName ?? leadName,
      );

  BrokerReservationDetail toDetail() => BrokerReservationDetail(
        reservation: toEntity(),
        leadName: leadName,
        bookingAmount: bookingAmount,
      );
}
