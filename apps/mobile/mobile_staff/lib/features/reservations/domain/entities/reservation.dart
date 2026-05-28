import 'package:core/core_domain.dart';

/// A unit reservation (list projection). `status` is the wire value
/// (PENDING/APPROVED/REJECTED/CANCELLED/EXPIRED/CONVERTED).
class Reservation extends Equatable {
  const Reservation({
    required this.id,
    required this.status,
    this.reservationNumber,
    this.expiresAt,
    this.createdAt,
    this.clientName,
    this.clientPhone,
    this.projectName,
    this.unitCode,
    this.bookingAmount,
  });

  final String id;
  final String status;
  final String? reservationNumber;
  final DateTime? expiresAt;
  final DateTime? createdAt;
  final String? clientName;
  final String? clientPhone;
  final String? projectName;
  final String? unitCode;
  final String? bookingAmount;

  @override
  List<Object?> get props => [id, status, reservationNumber, expiresAt, createdAt];
}

/// One entry on a reservation timeline (note or activity).
class ReservationTimelineEntry extends Equatable {
  const ReservationTimelineEntry({
    required this.id,
    required this.body,
    required this.isNote,
    this.authorName,
    this.createdAt,
  });

  final String id;
  final String body;
  final bool isNote;
  final String? authorName;
  final DateTime? createdAt;

  @override
  List<Object?> get props => [id, body, isNote, authorName, createdAt];
}

class ReservationDetail extends Equatable {
  const ReservationDetail({required this.reservation, required this.timeline, this.planName});
  final Reservation reservation;
  final List<ReservationTimelineEntry> timeline;
  final String? planName;

  @override
  List<Object?> get props => [reservation, timeline, planName];
}

/// Input for creating a reservation. `unitId` is required by the API.
class NewReservation {
  const NewReservation({
    required this.unitId,
    this.leadId,
    this.clientId,
    this.notes,
    this.expiresInHours,
  });

  final String unitId;
  final String? leadId;
  final String? clientId;
  final String? notes;
  final int? expiresInHours;
}
