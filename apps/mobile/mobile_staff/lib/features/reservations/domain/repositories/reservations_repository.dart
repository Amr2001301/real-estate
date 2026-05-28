import 'package:core/core_domain.dart';

import '../entities/reservation.dart';

class ReservationsQuery {
  const ReservationsQuery({this.status, this.unitId, this.leadId});
  final String? status;
  final String? unitId;
  final String? leadId;
}

abstract interface class ReservationsRepository {
  Future<Result<List<Reservation>>> getReservations(ReservationsQuery query);
  Future<Result<ReservationDetail>> getReservation(String id);
  Future<Result<Reservation>> createReservation(NewReservation input);
  Future<Result<void>> addNote(String id, String body);
}
