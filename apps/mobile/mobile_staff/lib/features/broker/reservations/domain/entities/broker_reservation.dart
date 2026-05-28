import 'package:core/core_domain.dart';

/// A broker reservation request. `status` is the ReservationStatus wire value.
class BrokerReservation extends Equatable {
  const BrokerReservation({
    required this.id,
    required this.status,
    this.reservationNumber,
    this.expiresAt,
    this.createdAt,
    this.unitCode,
    this.projectName,
    this.clientName,
  });

  final String id;
  final String status;
  final String? reservationNumber;
  final DateTime? expiresAt;
  final DateTime? createdAt;
  final String? unitCode;
  final String? projectName;
  final String? clientName;

  @override
  List<Object?> get props => [id, status, reservationNumber, expiresAt, createdAt];
}

class BrokerReservationDetail extends Equatable {
  const BrokerReservationDetail({required this.reservation, this.leadName, this.bookingAmount});
  final BrokerReservation reservation;
  final String? leadName;
  final String? bookingAmount;

  @override
  List<Object?> get props => [reservation, leadName, bookingAmount];
}

/// Input for a broker reservation request (POST /portal/reservations).
class NewBrokerReservation {
  const NewBrokerReservation({
    required this.leadId,
    required this.unitId,
    this.notes,
    this.expiresInHours,
  });

  final String leadId;
  final String unitId;
  final String? notes;
  final int? expiresInHours;
}
